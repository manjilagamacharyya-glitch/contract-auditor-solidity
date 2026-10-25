import { runRuleDetectors } from './detectors.js';
import { runGeminiReview } from './gemini.js';
import { generateReportMarkdown, computeContractHash, computeReportHash } from './report.js';
import { AuditResult, Finding, Severity } from './types.js';

const SEVERITY_ORDER: Record<Severity, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
  Info: 4,
};

const PENALTIES: Record<Severity, number> = {
  Critical: 25,
  High: 15,
  Medium: 8,
  Low: 3,
  Info: 0,
};

function matchesCategory(ruleFinding: Finding, aiFinding: { name: string; description: string }): boolean {
  const cat = (ruleFinding.ruleCategory || '').toLowerCase();
  const text = `${aiFinding.name} ${aiFinding.description}`.toLowerCase();

  if (cat === 'reentrancy') return /reentrancy|re-entrancy|checks-effects/.test(text);
  if (cat === 'selfdestruct') return /selfdestruct|suicide/.test(text);
  if (cat === 'tx-origin') return /tx\.origin|origin/.test(text);
  if (cat === 'delegatecall') return /delegatecall/.test(text);
  if (cat === 'access-control') return /access control|authorization|privilege|onlyowner|unprotected/.test(text);
  if (cat === 'overflow') return /overflow|underflow|safemath|arithmetic/.test(text);
  if (cat === 'unchecked-call') return /unchecked|return value|send/.test(text);

  return ruleFinding.name.toLowerCase().includes(aiFinding.name.toLowerCase());
}

export function mergeFindings(ruleFindings: Finding[], aiFindings: { name: string; severity: Severity; line: number; description: string; fix: string }[]): Finding[] {
  const merged: Finding[] = [];
  const usedAiIndices = new Set<number>();

  // Process rule findings and check for matching AI findings within 3 lines
  for (const rf of ruleFindings) {
    let matchedAiIdx = -1;

    for (let j = 0; j < aiFindings.length; j++) {
      if (usedAiIndices.has(j)) continue;
      const af = aiFindings[j];
      const lineDiff = Math.abs(rf.line - af.line);

      if (lineDiff <= 3 && matchesCategory(rf, af)) {
        matchedAiIdx = j;
        break;
      }
    }

    if (matchedAiIdx !== -1) {
      usedAiIndices.add(matchedAiIdx);
      const matchedAi = aiFindings[matchedAiIdx];
      merged.push({
        id: `both-${rf.line}-${merged.length}`,
        name: rf.name,
        severity: rf.severity,
        line: rf.line,
        description: rf.description,
        fix: matchedAi.fix || rf.fix,
        origin: 'both',
        ruleCategory: rf.ruleCategory,
      });
    } else {
      merged.push({
        ...rf,
        origin: 'rule',
      });
    }
  }

  // Add remaining AI findings
  for (let j = 0; j < aiFindings.length; j++) {
    if (usedAiIndices.has(j)) continue;
    const af = aiFindings[j];
    merged.push({
      id: `ai-${af.line}-${j}`,
      name: af.name,
      severity: af.severity,
      line: af.line,
      description: af.description,
      fix: af.fix,
      origin: 'ai',
    });
  }

  // Sort by severity then by line
  merged.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.line - b.line;
  });

  return merged;
}

export function calculateScore(findings: Finding[]): number {
  let penalty = 0;
  for (const f of findings) {
    penalty += PENALTIES[f.severity] || 0;
  }
  return Math.max(0, 100 - penalty);
}

export function buildStats(findings: Finding[]) {
  return {
    critical: findings.filter((f) => f.severity === 'Critical').length,
    high: findings.filter((f) => f.severity === 'High').length,
    medium: findings.filter((f) => f.severity === 'Medium').length,
    low: findings.filter((f) => f.severity === 'Low').length,
    info: findings.filter((f) => f.severity === 'Info').length,
  };
}

export function auditSolidityRuleOnly(source: string, notice?: string): AuditResult {
  const ruleFindings = runRuleDetectors(source);

  // Sort findings by severity then line
  ruleFindings.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.line - b.line;
  });

  const score = calculateScore(ruleFindings);
  const stats = buildStats(ruleFindings);
  const contractHash = computeContractHash(source);

  let summary = '';
  if (ruleFindings.length === 0) {
    summary = 'No common vulnerability patterns detected by static analysis.';
  } else {
    summary = `Static rule analysis identified ${ruleFindings.length} potential security issues (${stats.critical} critical, ${stats.high} high, ${stats.medium} medium). Manual review and remediation are recommended prior to mainnet deployment.`;
  }

  const reportMarkdown = generateReportMarkdown({
    score,
    summary,
    findings: ruleFindings,
    contractHash,
    engine: 'rule-only',
  });

  const reportHash = computeReportHash(reportMarkdown);

  return {
    score,
    summary,
    findings: ruleFindings,
    contractHash,
    reportHash,
    reportMarkdown,
    engine: 'rule-only',
    notice,
    stats,
  };
}

export async function auditSolidity(source: string, apiKey?: string): Promise<AuditResult> {
  const ruleFindings = runRuleDetectors(source);

  if (!apiKey) {
    return auditSolidityRuleOnly(
      source,
      'AI review unavailable: GEMINI_API_KEY is not configured. Running rule checks only.'
    );
  }

  const geminiResponse = await runGeminiReview(source, ruleFindings, apiKey);

  if (!geminiResponse.result) {
    return auditSolidityRuleOnly(
      source,
      `AI review skipped (${geminiResponse.error || 'Connection error'}). Showing rule detector findings.`
    );
  }

  const aiVulns = (geminiResponse.result.vulnerabilities || []).map((v) => ({
    name: v.name,
    severity: v.severity as Severity,
    line: v.line,
    description: v.description,
    fix: v.fix,
  }));

  const merged = mergeFindings(ruleFindings, aiVulns);
  const score = calculateScore(merged);
  const stats = buildStats(merged);
  const contractHash = computeContractHash(source);
  const summary = geminiResponse.result.summary || 'Audit completed with hybrid rule and AI analysis.';

  const reportMarkdown = generateReportMarkdown({
    score,
    summary,
    findings: merged,
    contractHash,
    engine: 'hybrid',
  });

  const reportHash = computeReportHash(reportMarkdown);

  return {
    score,
    summary,
    findings: merged,
    contractHash,
    reportHash,
    reportMarkdown,
    engine: 'hybrid',
    stats,
  };
}
