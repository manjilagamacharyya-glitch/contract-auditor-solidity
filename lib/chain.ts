import { ethers } from 'ethers';
import { AnchorResult } from './types.js';

export const AUDIT_REGISTRY_ABI = [
  'function storeAudit(bytes32 reportHash, bytes32 contractHash, string source, uint8 score) returns (uint256)',
  'event AuditStored(uint256 indexed id, bytes32 indexed reportHash, bytes32 contractHash, string source, uint8 score, address auditor)',
];

export async function storeAuditOnChain(params: {
  reportHash: string;
  contractHash: string;
  source: string;
  score: number;
  rpcUrl?: string;
  privateKey?: string;
  registryAddress?: string;
}): Promise<AnchorResult> {
  const rpcUrl = params.rpcUrl || process.env.SEPOLIA_RPC_URL;
  const privateKey = params.privateKey || process.env.PRIVATE_KEY;
  const registryAddress = params.registryAddress || process.env.REGISTRY_ADDRESS;

  if (!rpcUrl) {
    throw new Error('Sepolia RPC URL is not configured (SEPOLIA_RPC_URL).');
  }

  if (!privateKey) {
    throw new Error('Server wallet private key is not configured (PRIVATE_KEY).');
  }

  if (!registryAddress || !ethers.isAddress(registryAddress)) {
    throw new Error('Valid registry contract address is not configured (REGISTRY_ADDRESS).');
  }

  let provider: ethers.JsonRpcProvider;
  try {
    provider = new ethers.JsonRpcProvider(rpcUrl);
  } catch (err: any) {
    throw new Error(`Failed to connect to Sepolia RPC: ${err?.message || 'Invalid RPC endpoint'}`);
  }

  let wallet: ethers.Wallet;
  try {
    wallet = new ethers.Wallet(privateKey, provider);
  } catch {
    throw new Error('Invalid server private key format.');
  }

  // Check wallet balance
  try {
    const balance = await provider.getBalance(wallet.address);
    if (balance === 0n) {
      throw new Error('Server wallet has no Sepolia ETH to cover gas fees.');
    }
  } catch (err: any) {
    if (err.message?.includes('no Sepolia ETH')) throw err;
    // Continue if RPC balance check is temporarily throttled
  }

  const contract = new ethers.Contract(registryAddress, AUDIT_REGISTRY_ABI, wallet);

  // Normalize bytes32 parameters
  const reportBytes32 = params.reportHash.startsWith('0x')
    ? params.reportHash
    : `0x${params.reportHash}`;
  const contractBytes32 = params.contractHash.startsWith('0x')
    ? params.contractHash
    : `0x${params.contractHash}`;

  const boundedScore = Math.max(0, Math.min(100, Math.round(params.score)));

  let tx: ethers.ContractTransactionResponse;
  try {
    tx = await contract.storeAudit(
      reportBytes32,
      contractBytes32,
      params.source,
      boundedScore
    );
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) {
      throw new Error('Server wallet has no Sepolia ETH to cover transaction gas.');
    }
    if (msg.includes('nonce too low')) {
      throw new Error('Transaction nonce conflict on Sepolia. Please retry in a moment.');
    }
    if (msg.includes('execution reverted')) {
      throw new Error(`Transaction reverted by registry contract: ${err.reason || 'Execution reverted'}`);
    }
    throw new Error(`Sepolia transaction failed: ${msg}`);
  }

  // Cap confirmation wait time to 8 seconds so serverless functions never time out
  try {
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 8000)
    );
    const receiptPromise = tx.wait(1);

    const receipt = await Promise.race([receiptPromise, timeoutPromise]);

    if (receipt) {
      return {
        txHash: tx.hash,
        status: 'confirmed',
        receipt: {
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed?.toString(),
        },
      };
    }
  } catch {
    // If confirmation wait errors or network stalls, still return txHash as pending
  }

  return {
    txHash: tx.hash,
    status: 'pending',
  };
}
