import React, { useState } from 'react';
import { AuditResult, AnchorResult } from '../../lib/types.js';
import { Database, ExternalLink, Check, Copy, AlertCircle, Loader2 } from 'lucide-react';

interface OnChainTabProps {
  auditResult: AuditResult;
  source: string;
  isServerAvailable: boolean;
  anchorResult: AnchorResult | null;
  onStoreOnSepolia: () => Promise<void>;
  isAnchoring: boolean;
  anchorError: string | null;
}

export const OnChainTab: React.FC<OnChainTabProps> = ({
  auditResult,
  source,
  isServerAvailable,
  anchorResult,
  onStoreOnSepolia,
  isAnchoring,
  anchorError,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { contractHash, reportHash, score } = auditResult;

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className="p-4 bg-white border border-[#D6D8D3] rounded">
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-4 h-4 text-[#2F5D50]" />
          <h2 className="text-xs font-semibold text-[#1C2321]">
            Sepolia On-Chain Audit Trail
          </h2>
        </div>
        <p className="text-xs text-[#59615E] leading-relaxed">
          Stores cryptographic hashes of the contract code, Markdown audit report, and security score immutably on the Ethereum Sepolia testnet for public verification.
        </p>
      </div>

      {/* Hashes & Metadata */}
      <div className="p-4 bg-white border border-[#D6D8D3] rounded space-y-3">
        {/* Contract Hash */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-[#1C2321]">Contract hash (keccak256)</span>
            <button
              onClick={() => handleCopy('contract', contractHash)}
              className="text-[#2F5D50] hover:underline flex items-center gap-1 text-[11px]"
            >
              {copiedField === 'contract' ? (
                <>
                  <Check className="w-3 h-3 text-[#2F5D50]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-[#59615E]" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="p-2 bg-[#F7F8F6] border border-[#EAECE8] rounded font-mono text-xs text-[#1C2321] break-all select-all">
            {contractHash}
          </div>
        </div>

        {/* Report Hash */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-[#1C2321]">Report hash (keccak256)</span>
            <button
              onClick={() => handleCopy('report', reportHash)}
              className="text-[#2F5D50] hover:underline flex items-center gap-1 text-[11px]"
            >
              {copiedField === 'report' ? (
                <>
                  <Check className="w-3 h-3 text-[#2F5D50]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-[#59615E]" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="p-2 bg-[#F7F8F6] border border-[#EAECE8] rounded font-mono text-xs text-[#1C2321] break-all select-all">
            {reportHash}
          </div>
        </div>

        {/* Audit Score Record */}
        <div className="flex items-center justify-between pt-2 border-t border-[#EAECE8] text-xs">
          <span className="text-[#59615E]">Certified security score:</span>
          <span className="font-semibold text-[#1C2321]">{score} / 100</span>
        </div>
      </div>

      {/* Anchoring Status or Trigger */}
      <div className="p-4 bg-white border border-[#D6D8D3] rounded space-y-3">
        {anchorResult ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[#2F5D50]">
              <Check className="w-4 h-4 text-[#2F5D50]" />
              <span>
                {anchorResult.status === 'confirmed'
                  ? 'Audit successfully anchored on Sepolia'
                  : 'Transaction broadcast to Sepolia (pending confirmation)'}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <span className="text-[#59615E]">Transaction Hash:</span>
              <div className="p-2 bg-[#F7F8F6] border border-[#EAECE8] rounded font-mono text-xs text-[#1C2321] break-all">
                {anchorResult.txHash}
              </div>
            </div>

            {anchorResult.receipt && (
              <div className="text-xs text-[#59615E] flex items-center gap-4">
                <span>Block: #{anchorResult.receipt.blockNumber}</span>
                {anchorResult.receipt.gasUsed && (
                  <span>Gas: {anchorResult.receipt.gasUsed}</span>
                )}
              </div>
            )}

            <a
              href={`https://sepolia.etherscan.io/tx/${anchorResult.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#2F5D50] hover:underline font-medium pt-1"
            >
              <span>View on Sepolia Etherscan</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onStoreOnSepolia}
              disabled={!isServerAvailable || isAnchoring}
              className="w-full text-xs bg-[#2F5D50] hover:bg-[#264A40] active:bg-[#1E3B33] text-white py-2 px-4 rounded transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnchoring ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting transaction to Sepolia...</span>
                </>
              ) : (
                <span>Store audit on Sepolia</span>
              )}
            </button>

            {!isServerAvailable && (
              <p className="text-xs text-[#59615E] leading-relaxed">
                Sepolia anchoring requires server credentials (RPC & private key) configured in deployment.
              </p>
            )}

            {anchorError && (
              <div className="p-2.5 bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{anchorError}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
