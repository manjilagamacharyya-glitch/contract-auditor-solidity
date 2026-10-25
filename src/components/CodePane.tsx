import React, { useRef, useEffect } from 'react';
import { Finding, Severity } from '../../lib/types.js';
import { Edit3, CheckCircle2 } from 'lucide-react';

interface CodePaneProps {
  source: string;
  onChangeSource: (val: string) => void;
  isReadOnly: boolean;
  onSwitchToEdit: () => void;
  findings: Finding[];
  selectedFindingId: string | null;
  onSelectFinding: (findingId: string) => void;
}

const SEVERITY_STYLES: Record<
  Severity,
  { bg: string; border: string; text: string; badge: string }
> = {
  Critical: {
    bg: 'bg-[#FEE2E2]/70',
    border: 'border-l-4 border-l-[#B91C1C]',
    text: 'text-[#991B1B]',
    badge: 'bg-[#FCA5A5] text-[#7F1D1D]',
  },
  High: {
    bg: 'bg-[#FFEDD5]/70',
    border: 'border-l-4 border-l-[#C2410C]',
    text: 'text-[#9A3412]',
    badge: 'bg-[#FDBA74] text-[#7C2D12]',
  },
  Medium: {
    bg: 'bg-[#FEF3C7]/70',
    border: 'border-l-4 border-l-[#B45309]',
    text: 'text-[#92400E]',
    badge: 'bg-[#FCD34D] text-[#78350F]',
  },
  Low: {
    bg: 'bg-[#F3F4F6]',
    border: 'border-l-4 border-l-[#4B5563]',
    text: 'text-[#374151]',
    badge: 'bg-[#E5E7EB] text-[#1F2937]',
  },
  Info: {
    bg: 'bg-[#F3F4F6]',
    border: 'border-l-4 border-l-[#6B7280]',
    text: 'text-[#374151]',
    badge: 'bg-[#E5E7EB] text-[#1F2937]',
  },
};

export const CodePane: React.FC<CodePaneProps> = ({
  source,
  onChangeSource,
  isReadOnly,
  onSwitchToEdit,
  findings,
  selectedFindingId,
  onSelectFinding,
}) => {
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightedListRef = useRef<HTMLDivElement>(null);

  const lines = source.split(/\r?\n/);
  const lineCount = lines.length;

  // Build map from line number -> highest severity finding
  const lineFindingMap = new Map<number, Finding>();
  for (const f of findings) {
    if (!lineFindingMap.has(f.line)) {
      lineFindingMap.set(f.line, f);
    } else {
      const existing = lineFindingMap.get(f.line)!;
      const rank: Record<Severity, number> = {
        Critical: 0,
        High: 1,
        Medium: 2,
        Low: 3,
        Info: 4,
      };
      if (rank[f.severity] < rank[existing.severity]) {
        lineFindingMap.set(f.line, f);
      }
    }
  }

  // Scroll sync between textarea and line gutter
  const handleTextareaScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Scroll to selected finding line
  useEffect(() => {
    if (!isReadOnly || !selectedFindingId) return;
    const targetFinding = findings.find((f) => f.id === selectedFindingId);
    if (!targetFinding) return;

    const el = document.getElementById(`code-line-${targetFinding.line}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedFindingId, isReadOnly, findings]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue =
        source.substring(0, start) + '    ' + source.substring(end);
      onChangeSource(newValue);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-[#D6D8D3] rounded">
      {/* Pane header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#D6D8D3] bg-[#F7F8F6] text-xs">
        <div className="flex items-center gap-2 font-mono text-[#59615E]">
          <span className="font-semibold text-[#1C2321]">Contract.sol</span>
          <span>({lineCount} lines)</span>
        </div>

        {isReadOnly ? (
          <div className="flex items-center gap-2">
            <span className="text-[#59615E] hidden sm:inline">
              Read-only view (flagged lines highlighted)
            </span>
            <button
              onClick={onSwitchToEdit}
              className="text-[#2F5D50] hover:underline flex items-center gap-1 font-medium"
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit code</span>
            </button>
          </div>
        ) : (
          <span className="text-[#59615E]">Solidity Source Editor</span>
        )}
      </div>

      {/* Editor / Read-only container */}
      <div className="flex-1 relative overflow-hidden font-mono text-xs leading-5">
        {!isReadOnly ? (
          <div className="flex h-full w-full">
            {/* Line numbers gutter */}
            <div
              ref={lineNumbersRef}
              className="w-12 bg-[#F3F4F2] text-[#8C938E] py-3 text-right pr-3 select-none overflow-hidden border-r border-[#D6D8D3] shrink-0 font-mono"
            >
              {Array.from({ length: Math.max(lineCount, 1) }).map((_, i) => (
                <div key={i + 1} className="h-5">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Editable textarea */}
            <textarea
              ref={textareaRef}
              value={source}
              onChange={(e) => onChangeSource(e.target.value)}
              onScroll={handleTextareaScroll}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              placeholder="// Paste your Solidity smart contract here..."
              className="flex-1 p-3 bg-white text-[#1C2321] resize-none outline-none overflow-y-auto whitespace-pre font-mono leading-5 selection:bg-[#D6D8D3]"
            />
          </div>
        ) : (
          /* Read-only highlighted line list */
          <div
            ref={highlightedListRef}
            className="h-full overflow-y-auto overflow-x-auto py-2 bg-white"
          >
            {lines.map((lineText, idx) => {
              const lineNum = idx + 1;
              const finding = lineFindingMap.get(lineNum);
              const isSelected = selectedFindingId === finding?.id;
              const severityStyle = finding ? SEVERITY_STYLES[finding.severity] : null;

              return (
                <div
                  key={lineNum}
                  id={`code-line-${lineNum}`}
                  onClick={() => finding && onSelectFinding(finding.id)}
                  className={`flex items-start group min-w-max transition-colors ${
                    finding
                      ? `${severityStyle?.bg} ${severityStyle?.border} cursor-pointer`
                      : 'hover:bg-[#F9FAF8] border-l-4 border-l-transparent'
                  } ${isSelected ? 'ring-1 ring-[#1C2321]' : ''}`}
                >
                  {/* Line Number */}
                  <div
                    className={`w-12 shrink-0 pr-3 text-right select-none py-0.5 border-r border-[#EAECE8] ${
                      finding ? severityStyle?.text : 'text-[#8C938E]'
                    }`}
                  >
                    {lineNum}
                  </div>

                  {/* Code text */}
                  <div className="flex-1 px-3 py-0.5 whitespace-pre font-mono text-[#1C2321]">
                    {lineText || ' '}
                  </div>

                  {/* Finding tag indicator */}
                  {finding && (
                    <div className="pr-3 py-0.5 shrink-0 select-none">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-sans uppercase font-medium ${severityStyle?.badge}`}
                        title={finding.name}
                      >
                        {finding.severity}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pane Footer Status */}
      <div className="px-3 py-1.5 border-t border-[#D6D8D3] bg-[#F7F8F6] text-[11px] text-[#59615E] flex items-center justify-between">
        <span>Solidity 0.4.x - 0.8.x</span>
        {findings.length > 0 && isReadOnly ? (
          <span className="text-[#991B1B] font-medium">
            {findings.length} issue{findings.length === 1 ? '' : 's'} highlighted
          </span>
        ) : isReadOnly ? (
          <span className="text-[#2F5D50] flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" /> No vulnerabilities detected
          </span>
        ) : (
          <span>Ready to audit</span>
        )}
      </div>
    </div>
  );
};
