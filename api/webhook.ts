import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { auditSolidity } from '../lib/audit.js';
import { storeAuditOnChain } from '../lib/chain.js';

export const config = {
  maxDuration: 60,
};

function verifySignature(payload: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  const digestBuf = Buffer.from(digest);
  const sigBuf = Buffer.from(signature);

  if (digestBuf.length !== sigBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuf, sigBuf);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const signature = req.headers['x-hub-signature-256'] as string | undefined;

  // Retrieve raw payload
  let rawPayload = '';
  if (typeof req.body === 'string') {
    rawPayload = req.body;
  } else if ((req as any).rawBody) {
    rawPayload = (req as any).rawBody.toString('utf8');
  } else {
    rawPayload = JSON.stringify(req.body);
  }

  if (webhookSecret) {
    const isValid = verifySignature(rawPayload, signature, webhookSecret);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid HMAC signature.' });
    }
  }

  const eventName = req.headers['x-github-event'];
  if (eventName !== 'pull_request') {
    return res.status(200).json({ message: `Ignored non-pull_request event: ${eventName}` });
  }

  const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const action = payload.action;

  if (!['opened', 'synchronize', 'reopened'].includes(action)) {
    return res.status(200).json({ message: `Ignored pull_request action: ${action}` });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error('GITHUB_TOKEN is not configured on the server.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const pullRequest = payload.pull_request;
  const repo = payload.repository;
  const owner = repo.owner.login;
  const repoName = repo.name;
  const pullNumber = pullRequest.number;
  const headSha = pullRequest.head.sha;

  try {
    // 1. Fetch changed files in the PR
    const filesResp = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/pulls/${pullNumber}/files`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Contract-Auditor',
        },
      }
    );

    if (!filesResp.ok) {
      const errText = await filesResp.text();
      console.error('Failed to fetch PR files from GitHub:', errText);
      return res.status(filesResp.status).json({
        error: 'Failed to fetch pull request files from GitHub.',
      });
    }

    const files: any[] = await filesResp.json();
    const solFiles = files.filter(
      (f) => f.filename.endsWith('.sol') && f.status !== 'removed'
    );

    if (solFiles.length === 0) {
      return res.status(200).json({
        message: 'No Solidity (.sol) files modified in this PR. Skipping audit.',
      });
    }

    // 2. Fetch content for each Solidity file and run audit
    const fileAuditResults: {
      filename: string;
      score: number;
      findings: any[];
      contractHash: string;
      reportHash: string;
      txHash?: string;
    }[] = [];

    const apiKey = process.env.GEMINI_API_KEY;

    for (const file of solFiles) {
      const contentResp = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repoName}/${headSha}/${file.filename}`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            'User-Agent': 'Contract-Auditor',
          },
        }
      );

      if (!contentResp.ok) continue;
      const source = await contentResp.text();

      const audit = await auditSolidity(source, apiKey);

      // Attempt optional Sepolia anchoring
      let txHash: string | undefined;
      try {
        if (process.env.SEPOLIA_RPC_URL && process.env.PRIVATE_KEY && process.env.REGISTRY_ADDRESS) {
          const anchor = await storeAuditOnChain({
            reportHash: audit.reportHash,
            contractHash: audit.contractHash,
            source,
            score: audit.score,
          });
          txHash = anchor.txHash;
        }
      } catch (chainErr) {
        console.warn('Optional on-chain anchoring failed during webhook:', chainErr);
      }

      fileAuditResults.push({
        filename: file.filename,
        score: audit.score,
        findings: audit.findings,
        contractHash: audit.contractHash,
        reportHash: audit.reportHash,
        txHash,
      });
    }

    if (fileAuditResults.length === 0) {
      return res.status(200).json({ message: 'No Solidity files could be audited.' });
    }

    // 3. Compose single PR review comment
    const avgScore = Math.round(
      fileAuditResults.reduce((acc, curr) => acc + curr.score, 0) / fileAuditResults.length
    );

    let allFindings: { filename: string; finding: any }[] = [];
    fileAuditResults.forEach((fa) => {
      fa.findings.forEach((f) => {
        allFindings.push({ filename: fa.filename, finding: f });
      });
    });

    let commentBody = `## Contract Auditor Automated Review

**Overall Security Score:** **${avgScore} / 100**
Scanned ${fileAuditResults.length} Solidity file(s) in commit \`${headSha.slice(0, 7)}\`.

`;

    if (allFindings.length === 0) {
      commentBody += `No known vulnerability patterns detected. The contracts pass static analysis.\n`;
    } else {
      commentBody += `### Vulnerability Summary\n\n`;
      commentBody += `| Severity | Issue | Location | Source |\n`;
      commentBody += `| :--- | :--- | :--- | :--- |\n`;

      for (const item of allFindings) {
        const originLabel =
          item.finding.origin === 'both'
            ? 'Rule & AI'
            : item.finding.origin === 'ai'
            ? 'AI Review'
            : 'Rule Check';
        commentBody += `| **${item.finding.severity}** | ${item.finding.name} | \`${item.filename}:${item.finding.line}\` | ${originLabel} |\n`;
      }

      const criticalAndHigh = allFindings.filter(
        (f) => f.finding.severity === 'Critical' || f.finding.severity === 'High'
      );

      if (criticalAndHigh.length > 0) {
        commentBody += `\n### Recommended Fixes for Critical and High Issues\n\n`;
        for (const item of criticalAndHigh) {
          commentBody += `#### [${item.finding.severity}] ${item.finding.name} (\`${item.filename}:${item.finding.line}\`)\n`;
          commentBody += `${item.finding.description}\n\n`;
          commentBody += `Suggested remediation:\n\`\`\`solidity\n${item.finding.fix}\n\`\`\`\n\n`;
        }
      }
    }

    // On-chain anchor links
    const anchoredFiles = fileAuditResults.filter((f) => f.txHash);
    if (anchoredFiles.length > 0) {
      commentBody += `\n### Immutable Audit Trail (Sepolia)\n\n`;
      for (const f of anchoredFiles) {
        commentBody += `- \`${f.filename}\`: [View on Etherscan](https://sepolia.etherscan.io/tx/${f.txHash})\n`;
      }
    }

    commentBody += `\n---\n*Audit generated automatically by Contract Auditor webhook.*`;

    // 4. Post comment on the PR
    const commentResp = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/issues/${pullNumber}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Contract-Auditor',
        },
        body: JSON.stringify({ body: commentBody }),
      }
    );

    if (!commentResp.ok) {
      const errText = await commentResp.text();
      console.error('Failed to post PR comment to GitHub:', errText);
      return res.status(commentResp.status).json({
        error: 'Failed to post comment to pull request.',
      });
    }

    return res.status(200).json({
      status: 'success',
      score: avgScore,
      filesAudited: fileAuditResults.length,
      findingsCount: allFindings.length,
    });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return res.status(500).json({
      error: 'An unexpected error occurred processing the webhook.',
    });
  }
}
