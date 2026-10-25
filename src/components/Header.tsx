import React from 'react';
import { ShieldAlert, Play, FileCode, Edit3 } from 'lucide-react';

interface HeaderProps {
  onLoadSample: () => void;
  onRunAudit: () => void;
  onEditCode: () => void;
  isAuditing: boolean;
  isReadOnly: boolean;
  hasResult: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onLoadSample,
  onRunAudit,
  onEditCode,
  isAuditing,
  isReadOnly,
  hasResult,
}) => {
  return (
    <header className="bg-white border-b border-[#D6D8D3] px-4 py-3 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="text-[#2F5D50]">
          <ShieldAlert className="w-6 h-6 stroke-[1.75]" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-[#1C2321] leading-tight">
            Contract Auditor
          </h1>
          <p className="text-xs text-[#59615E] leading-normal">
            AI-powered Solidity vulnerability scanner and Sepolia audit registry
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onLoadSample}
          disabled={isAuditing}
          className="text-xs bg-[#F3F4F2] hover:bg-[#EAECE8] text-[#1C2321] border border-[#D6D8D3] px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <FileCode className="w-3.5 h-3.5 text-[#59615E]" />
          <span>Load vulnerable sample</span>
        </button>

        {isReadOnly ? (
          <button
            type="button"
            onClick={onEditCode}
            className="text-xs bg-white hover:bg-[#F3F4F2] text-[#1C2321] border border-[#D6D8D3] px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#59615E]" />
            <span>Edit code</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={onRunAudit}
          disabled={isAuditing}
          className="text-xs bg-[#2F5D50] hover:bg-[#264A40] active:bg-[#1E3B33] text-white px-3.5 py-1.5 rounded transition-colors flex items-center gap-1.5 font-medium disabled:opacity-50 shadow-none"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isAuditing ? 'Analyzing contract...' : hasResult ? 'Re-run audit' : 'Run audit'}</span>
        </button>
      </div>
    </header>
  );
};
