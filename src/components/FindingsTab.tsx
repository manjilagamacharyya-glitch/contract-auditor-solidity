import React, { useState } from 'react';
import { AuditResult, Finding, Severity } from '../../lib/types.js';
import { Check, Copy, Shield, AlertTriangle, Info, ArrowUpRight } from 'lucide-react';

interface FindingsTabProps {
  auditResult: AuditResult;
  selectedFindingId: string | null;
  onSelectFinding: (findingId: string) => void;
}

const SEVERITY_BADGES: Record<
  Severity,
  { bg: string; text: string; border: string }
> = {
  Critical: { bg: 'bg-[#FEE2E2]', text: 'text-[#991B1B]', border: 'border-[#FCA5A5]' },
  High: { bg: 'bg-[#FFEDD5]', text: 'text-[#9A3412]', border: 'border-[#FDBA74]' },
  Medium: { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]', border: 'border-[#FCD34D]' },
  Low: { bg: 'bg-[#F3F4F6]', text: 'text-[#374151]', border: 'border-[#E5E7EB]' },
  Info: { bg: 'bg-[#F3F4F6]', text: 'text-[#374151]', border: 'border-[#E5E7EB]' },
};

function getScoreTone(score: number): { label: string; textClass: string; bgClass: string } {
  if (score >= 85) {
    return { label: 'Low risk', textClass: 'text-[#2F5D50]', bgClass: 'bg-[#EAF3F0]' };
  }
  if (score >= 60) {
    return { label: 'Medium risk', textClass: 'text-[#B45309]', bgClass: 'bg-[#FEF3C7]' };
  }
  return { label: 'High risk', textClass: 'text-[#991B1B]', bgClass: 'bg-[#FEE2E2]' };
}

export const FindingsTab: React.FC<FindingsTabProps> = ({
  auditResult,
  selectedFindingId,
  onSelectFinding,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const { score, findings, stats, summary } = auditResult;
  const scoreTone = getScoreTone(score);

  const handleCopyFix = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredFindings =
    filterSeverity === 'all'
      ? findings
      : findings.filter((f) => f.severity.toLowerCase() === filterSeverity.toLowerCase());

  return (
    <div className="space-y-4">
      {/* Top Score & Summary Card */}
      <div className="p-4 bg-white border border-[#D6D8D3] rounded">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <span className="text-xs text-[#59615E]">Security score</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-semibold tracking-tight text-[#1C2321]">
                {score}
              </span>
              <span className="text-sm text-[#59615E]">/ 100</span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ml-2 ${scoreTone.bgClass} ${scoreTone.textClass}`}
              >
                {scoreTone.label}
              </span>
            </div>
          </div>

          {/* Severity Counters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterSeverity('all')}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                filterSeverity === 'all'
                  ? 'bg-[#1C2321] text-white border-[#1C2321]'
                  : 'bg-white text-[#1C2321] border-[#D6D8D3] hover:bg-[#F3F4F2]'
              }`}
            >
              All ({findings.length})
            </button>
            <button
              onClick={() => setFilterSeverity('critical')}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                filterSeverity === 'critical'
                  ? 'bg-[#991B1B] text-white border-[#991B1B]'
                  : 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5] hover:bg-[#FECACA]'
              }`}
            >
              Critical ({stats.critical})
            </button>
            <button
              onClick={() => setFilterSeverity('high')}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                filterSeverity === 'high'
                  ? 'bg-[#9A3412] text-white border-[#9A3412]'
                  : 'bg-[#FFEDD5] text-[#9A3412] border-[#FDBA74] hover:bg-[#FED7AA]'
              }`}
            >
              High ({stats.high})
            </button>
            <button
              onClick={() => setFilterSeverity('medium')}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                filterSeverity === 'medium'
                  ? 'bg-[#92400E] text-white border-[#92400E]'
                  : 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D] hover:bg-[#FDE68A]'
              }`}
            >
              Medium ({stats.medium})
            </button>
          </div>
        </div>

        {/* Executive summary statement */}
        <p className="mt-3 text-xs text-[#59615E] leading-relaxed border-t border-[#EAECE8] pt-3">
          {summary}
        </p>
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {filteredFindings.length === 0 ? (
          <div className="p-8 text-center bg-white border border-[#D6D8D3] rounded text-sm text-[#59615E]">
            No issues found
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const badge = SEVERITY_BADGES[finding.severity];
            const isSelected = selectedFindingId === finding.id;

            const originLabel =
              finding.origin === 'both'
                ? 'rule check + AI review'
                : finding.origin === 'ai'
                ? 'AI review'
                : 'rule check';

            return (
              <div
                key={finding.id}
                onClick={() => onSelectFinding(finding.id)}
                className={`p-3.5 bg-white border rounded transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#1C2321] ring-1 ring-[#1C2321]'
                    : 'border-[#D6D8D3] hover:border-[#AAB0A6]'
                }`}
              >
                {/* Header row: Severity, Title, Line, Origin */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded border font-medium ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      {finding.severity}
                    </span>
                    <h3 className="text-xs font-semibold text-[#1C2321]">
                      {finding.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-[#59615E] bg-[#F3F4F2] px-1.5 py-0.5 rounded border border-[#EAECE8]">
                      Line {finding.line}
                    </span>
                    <span className="text-[10px] text-[#59615E] bg-[#F7F8F6] px-1.5 py-0.5 rounded border border-[#EAECE8]">
                      {originLabel}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="mt-2 text-xs text-[#1C2321] leading-relaxed">
                  {finding.description}
                </p>

                {/* Suggested Fix */}
                <div className="mt-3 bg-[#F7F8F6] border border-[#D6D8D3] rounded p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-medium text-[#59615E]">
                      Suggested fix
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyFix(finding.id, finding.fix);
                      }}
                      className="text-[11px] text-[#2F5D50] hover:underline flex items-center gap-1 font-mono"
                    >
                      {copiedId === finding.id ? (
                        <>
                          <Check className="w-3 h-3 text-[#2F5D50]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#59615E]" />
                          <span>Copy fix</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="font-mono text-[11px] text-[#1C2321] whitespace-pre-wrap leading-tight overflow-x-auto selection:bg-[#D6D8D3]">
                    {finding.fix}
                  </pre>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
