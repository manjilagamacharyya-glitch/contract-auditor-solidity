# Contract Auditor

An AI-powered Solidity smart contract auditor built for hackathons and CI/CD pipelines. It performs hybrid static analysis and Gemini AI security reviews, anchors audit reports immutably on the Sepolia testnet, and scans pull requests automatically via GitHub webhooks.

## Architecture

- **Frontend:** React, Vite, TypeScript, Tailwind CSS. A dense two-pane review tool (code editor with line highlighting on the left, findings/report/on-chain tabs on the right).
- **Backend:** Vercel Serverless Functions (`/api/audit.ts`, `/api/anchor.ts`, `/api/webhook.ts`).
- **Detection Engine (`/lib/detectors.ts`):** Rule-based checks with brace-matched function extraction:
  - Reentrancy detection (external `.call` preceding state writes without `nonReentrant`)
  - Unprotected `selfdestruct`
  - Insecure `tx.origin` authorization
  - Unprotected `delegatecall`
  - Missing access control on sensitive functions (`set*`, `mint*`, `burn*`, `transferOwnership`, `upgrade*`, `pause`)
  - Arithmetic overflow/underflow (< 0.8.0 without `SafeMath`)
  - Unchecked low-level `send` and `call` return values
- **AI Review (`/lib/gemini.ts`):** Google Gemini (`gemini-2.5-flash`) with structured JSON schema output and 25-second timeout.
- **Deduplication & Scoring (`/lib/audit.ts`):** Merges rule and AI findings (matches within 3 lines marked as combined). Computes penalties: Critical (-25), High (-15), Medium (-8), Low (-3).
- **On-chain Registry (`/lib/chain.ts`):** Stores `storeAudit(bytes32 reportHash, bytes32 contractHash, string source, uint8 score)` on the Sepolia testnet using ethers v6.
- **GitHub Webhook (`/api/webhook.ts`):** Verifies HMAC SHA-256 signatures, filters `.sol` changes, runs audits, and comments actionable fixes directly on the pull request.

## Local Setup

1. Clone repository and install dependencies:
   ```bash
   npm install
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your `GEMINI_API_KEY`, and optionally `SEPOLIA_RPC_URL`, `PRIVATE_KEY`, and `REGISTRY_ADDRESS`.

3. Run the development server:
   ```bash
   npm run dev
   ```

*Note: In the AI Studio preview environment, serverless functions are not hosted locally. The frontend automatically falls back to in-browser static rule analysis with full vulnerability detection.*

## Environment Variables

| Variable | Description |
| :--- | :--- |
| `GEMINI_API_KEY` | Google Gemini API key for AI-assisted contract review. |
| `SEPOLIA_RPC_URL` | Ethereum Sepolia JSON-RPC provider URL (Alchemy, Infura, etc.). |
| `PRIVATE_KEY` | Hex private key for the auditor wallet with Sepolia ETH. |
| `REGISTRY_ADDRESS` | Address of deployed `AuditRegistry` smart contract on Sepolia. |
| `GITHUB_TOKEN` | GitHub Personal Access Token (requires repo read & comment access). |
| `GITHUB_WEBHOOK_SECRET` | Secret used to verify HMAC SHA-256 signatures on PR webhooks. |

## Deploying on Vercel

1. Push your repository to GitHub.
2. Import the project in Vercel. Vercel will detect Vite and use `vercel.json` for routing.
3. Add the environment variables listed above in the Vercel Project Settings under **Environment Variables**.
4. Deploy. Both the Vite React frontend and the `/api/*` serverless functions will be deployed together.

## GitHub Webhook Setup

1. In your GitHub repository, navigate to **Settings > Webhooks > Add webhook**.
2. **Payload URL:** `https://your-vercel-domain.vercel.app/api/webhook`
3. **Content type:** `application/json`
4. **Secret:** Set your chosen secret string and put the exact same value in `GITHUB_WEBHOOK_SECRET` in Vercel.
5. **Which events would you like to trigger this webhook?** Select **Let me select individual events**, check **Pull requests**, and uncheck Pushes.
6. Click **Add webhook**. Any pull request modifying `.sol` files will receive an automated audit comment with line-by-line fixes.

## Disclaimer & Limitations

Contract Auditor is designed as a rapid, automated first-pass auditing and CI linting tool. It identifies common vulnerability patterns and code smells, but it is **not** a formal verification tool and cannot guarantee total contract security. It is not a replacement for a manual audit by a certified human security auditing firm prior to deploying significant capital on mainnet.
