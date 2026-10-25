import React, { useState } from 'react';
import { Download, Copy, Check, FileText } from 'lucide-react';

interface ReportTabProps {
  reportMarkdown: string;
}

export const ReportTab: React.FC<ReportTabProps> = ({ reportMarkdown }) => {
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    const blob = new Blob([reportMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-audit-report-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between p-3 bg-white border border-[#D6D8D3] rounded">
        <div className="flex items-center gap-2 text-xs text-[#59615E]">
          <FileText className="w-4 h-4 text-[#2F5D50]" />
          <span className="font-medium text-[#1C2321]">Full Audit Report</span>
          <span>(Markdown format)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs bg-[#F3F4F2] hover:bg-[#EAECE8] text-[#1C2321] border border-[#D6D8D3] px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#2F5D50]" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#59615E]" />
                <span>Copy markdown</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="text-xs bg-[#2F5D50] hover:bg-[#264A40] text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download report (.md)</span>
          </button>
        </div>
      </div>

      {/* Rendered Markdown View */}
      <div className="p-6 bg-white border border-[#D6D8D3] rounded text-[#1C2321] text-xs leading-relaxed space-y-4 font-mono whitespace-pre-wrap selection:bg-[#D6D8D3] overflow-x-auto">
        {reportMarkdown}
      </div>
    </div>
  );
};
