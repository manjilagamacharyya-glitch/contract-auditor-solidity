import { GoogleGenAI, Type } from '@google/genai';
import { Finding, Severity } from './types.js';

export interface GeminiAuditResponse {
  summary: string;
  vulnerabilities: {
    name: string;
    severity: string;
    line: number;
    description: string;
    fix: string;
  }[];
}

export async function runGeminiReview(
  source: string,
  ruleFindings: Finding[],
  apiKey: string
): Promise<{ result: GeminiAuditResponse | null; error?: string }> {
  if (!apiKey) {
    return { result: null, error: 'GEMINI_API_KEY is not configured' };
  }

  // Prepend line numbers to source code for Gemini
  const numberedLines = source
    .split(/\r?\n/)
    .map((line, idx) => `${idx + 1}: ${line}`)
    .join('\n');

  const ruleSummary =
    ruleFindings.length > 0
      ? ruleFindings
          .map(
            (f) =>
              `- [Line ${f.line}] ${f.name} (${f.severity}): ${f.description}`
          )
          .join('\n')
      : 'No automated rule findings.';

  const prompt = `You are a world-class smart contract security auditor.
Analyze the following Solidity smart contract for vulnerabilities, logic errors, access control defects, reentrancy, arithmetic issues, and best practices.

Existing preliminary detector findings:
${ruleSummary}

Solidity Source Code (with 1-based line numbers):
\`\`\`solidity
${numberedLines}
\`\`\`

Perform an in-depth security audit. Validate the preliminary findings and discover any other critical, high, medium, or low severity vulnerabilities.
Provide an executive summary and a list of specific vulnerabilities with exact 1-based line numbers, severity (Critical, High, Medium, Low, Info), clear descriptions, and concrete code fixes.`;

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API call timed out after 25 seconds')), 25000);
    });

    const apiCallPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'Executive summary of the security audit',
            },
            vulnerabilities: {
              type: Type.ARRAY,
              description: 'List of detected vulnerabilities and security issues',
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  line: { type: Type.INTEGER },
                  description: { type: Type.STRING },
                  fix: { type: Type.STRING },
                },
                required: ['name', 'severity', 'line', 'description', 'fix'],
              },
            },
          },
          required: ['summary', 'vulnerabilities'],
        },
      },
    });

    const response = await Promise.race([apiCallPromise, timeoutPromise]);
    const rawText = response.text || '';

    // Strip markdown code fences defensively
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    const parsed: GeminiAuditResponse = JSON.parse(cleaned);

    // Normalize severities
    const normalizedVulns = (parsed.vulnerabilities || []).map((v) => {
      const s = (v.severity || '').toLowerCase();
      let sev: Severity = 'Medium';
      if (s.includes('crit')) sev = 'Critical';
      else if (s.includes('high')) sev = 'High';
      else if (s.includes('med')) sev = 'Medium';
      else if (s.includes('low')) sev = 'Low';
      else if (s.includes('info')) sev = 'Info';

      return {
        ...v,
        severity: sev,
        line: Number(v.line) || 1,
      };
    });

    return {
      result: {
        summary: parsed.summary || 'Solidity smart contract audit completed.',
        vulnerabilities: normalizedVulns,
      },
    };
  } catch (err: any) {
    return {
      result: null,
      error: err?.message || 'Gemini review encountered an unexpected error',
    };
  }
}
