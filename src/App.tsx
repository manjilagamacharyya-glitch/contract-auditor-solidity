import React, { useState } from 'react';
import { Header } from './components/Header.tsx';
import { NoticeBanner } from './components/NoticeBanner.tsx';
import { CodePane } from './components/CodePane.tsx';
import { FindingsTab } from './components/FindingsTab.tsx';
import { ReportTab } from './components/ReportTab.tsx';
import { OnChainTab } from './components/OnChainTab.tsx';
import { VULNERABLE_CONTRACT_SAMPLE } from '../lib/sample.js';
import { auditSolidityRuleOnly } from '../lib/audit.js';
import { AuditResult, AnchorResult } from '../lib/types.js';
import { Shield, FileText, Database } from 'lucide-react';

export default function App() {
  const [source, setSource] = useState<string>(VULNERABLE_CONTRACT_SAMPLE);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'findings' | 'report' | 'onchain'>('findings');
  const [notice, setNotice] = useState<string | null>(null);
  const [isServerAvailable, setIsServerAvailable] = useState<boolean>(false);
  const [anchorResult, setAnchorResult] = useState<AnchorResult | null>(null);
  const [isAnchoring, setIsAnchoring] = useState<boolean>(false);
  const [anchorError, setAnchorError] = useState<string | null>(null);

  const handleRunAudit = async () => {
    if (!source.trim()) return;

    setIsAuditing(true);
    setAnchorResult(null);
    setAnchorError(null);

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const result: AuditResult = await response.json();
      setAuditResult(result);
      setIsServerAvailable(true);
      setNotice(result.notice || null);
      setIsReadOnly(true);
      setActiveTab('findings');
      if (result.findings.length > 0) {
        setSelectedFindingId(result.findings[0].id);
      }
    } catch {
      // In-browser fallback when serverless /api is not available
      const fallbackResult = auditSolidityRuleOnly(source);
      setAuditResult(fallbackResult);
      setIsServerAvailable(false);
      setNotice('Server unavailable: running rule checks in the browser only');
      setIsReadOnly(true);
      setActiveTab('findings');
      if (fallbackResult.findings.length > 0) {
        setSelectedFindingId(fallbackResult.findings[0].id);
      }
    } finally {
      setIsAuditing(false);
    }
  };

  const handleLoadSample = () => {
    setSource(VULNERABLE_CONTRACT_SAMPLE);
    setIsReadOnly(false);
    setSelectedFindingId(null);
  };

  const handleSwitchToEdit = () => {
    setIsReadOnly(false);
  };

  const handleStoreOnSepolia = async () => {
    if (!auditResult) return;

    setIsAnchoring(true);
    setAnchorError(null);

    try {
      const response = await fetch('/api/anchor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportHash: auditResult.reportHash,
          contractHash: auditResult.contractHash,
          source,
          score: auditResult.score,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to anchor on Sepolia.');
      }

      setAnchorResult(data);
    } catch (err: any) {
      setAnchorError(err?.message || 'Failed to submit transaction to Sepolia.');
    } finally {
      setIsAnchoring(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F2] text-[#1C2321] flex flex-col font-sans">
      <Header
        onLoadSample={handleLoadSample}
        onRunAudit={handleRunAudit}
        onEditCode={handleSwitchToEdit}
        isAuditing={isAuditing}
        isReadOnly={isReadOnly}
        hasResult={auditResult !== null}
      />

      {notice && (
        <NoticeBanner message={notice} onDismiss={() => setNotice(null)} />
      )}

      {/* Main Two-Pane Workspace */}
      <main className="flex-1 p-3 sm:p-4 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 overflow-hidden">
        {/* Left Pane: Code Editor / Highlighted Viewer (7 cols) */}
        <section className="lg:col-span-7 h-[540px] lg:h-[calc(100vh-130px)] flex flex-col">
          <CodePane
            source={source}
            onChangeSource={setSource}
            isReadOnly={isReadOnly}
            onSwitchToEdit={handleSwitchToEdit}
            findings={auditResult?.findings || []}
            selectedFindingId={selectedFindingId}
            onSelectFinding={(id) => {
              setSelectedFindingId(id);
              setActiveTab('findings');
            }}
          />
        </section>

        {/* Right Pane: Findings, Report, On-chain (5 cols) */}
        <section className="lg:col-span-5 h-[540px] lg:h-[calc(100vh-130px)] flex flex-col bg-white border border-[#D6D8D3] rounded overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex items-center border-b border-[#D6D8D3] bg-[#F7F8F6] px-2 pt-2 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('findings')}
              className={`text-xs px-3 py-2 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'findings'
                  ? 'border-[#2F5D50] text-[#1C2321] bg-white rounded-t'
                  : 'border-transparent text-[#59615E] hover:text-[#1C2321]'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-[#59615E]" />
              <span>Findings</span>
              {auditResult && (
                <span className="text-[10px] bg-[#EAECE8] px-1.5 py-0.2 rounded font-mono">
                  {auditResult.findings.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`text-xs px-3 py-2 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'report'
                  ? 'border-[#2F5D50] text-[#1C2321] bg-white rounded-t'
                  : 'border-transparent text-[#59615E] hover:text-[#1C2321]'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#59615E]" />
              <span>Report</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('onchain')}
              className={`text-xs px-3 py-2 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'onchain'
                  ? 'border-[#2F5D50] text-[#1C2321] bg-white rounded-t'
                  : 'border-transparent text-[#59615E] hover:text-[#1C2321]'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-[#59615E]" />
              <span>On-chain</span>
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto bg-[#F9FAF8]">
            {!auditResult ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#59615E]">
                <Shield className="w-10 h-10 text-[#C4C8C1] stroke-[1.5] mb-3" />
                <h2 className="text-sm font-medium text-[#1C2321] mb-1">
                  Ready to audit
                </h2>
                <p className="text-xs text-[#59615E] max-w-sm">
                  Click &ldquo;Run audit&rdquo; above to scan the Solidity source code for vulnerabilities and generate a security report.
                </p>
              </div>
            ) : (
              <>
                {activeTab === 'findings' && (
                  <FindingsTab
                    auditResult={auditResult}
                    selectedFindingId={selectedFindingId}
                    onSelectFinding={setSelectedFindingId}
                  />
                )}

                {activeTab === 'report' && (
                  <ReportTab reportMarkdown={auditResult.reportMarkdown} />
                )}

                {activeTab === 'onchain' && (
                  <OnChainTab
                    auditResult={auditResult}
                    source={source}
                    isServerAvailable={isServerAvailable}
                    anchorResult={anchorResult}
                    onStoreOnSepolia={handleStoreOnSepolia}
                    isAnchoring={isAnchoring}
                    anchorError={anchorError}
                  />
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
