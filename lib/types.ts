export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';

export type FindingOrigin = 'rule' | 'ai' | 'both';

export interface Finding {
  id: string;
  name: string;
  severity: Severity;
  line: number;
  description: string;
  fix: string;
  origin: FindingOrigin;
  ruleCategory?: string;
}

export interface AuditResult {
  score: number;
  summary: string;
  findings: Finding[];
  contractHash: string;
  reportHash: string;
  reportMarkdown: string;
  engine: 'hybrid' | 'rule-only';
  notice?: string;
  stats: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export interface AnchorResult {
  txHash: string;
  status: 'confirmed' | 'pending';
  receipt?: {
    blockNumber: number;
    gasUsed?: string;
  };
}
