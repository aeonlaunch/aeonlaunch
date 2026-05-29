import type { Env } from './types';

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const AGGREGATE3_SELECTOR = '0x82ad56cb';
const BALANCES_SELECTOR = '0x27e235e3';
const GET_ETH_BALANCE_SELECTOR = '0x4d2301cc';

// tokenURI() selector = keccak256("tokenURI()")[0:4]  (no-arg version; 0xc87b56dd is tokenURI(uint256))
const TOKEN_URI_SELECTOR = '0x3c130d90';
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
];

function ipfsToHttp(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return IPFS_GATEWAYS[0] + uri.slice(7);
  }
  return uri;
}

/**
 * Resolve an ERC20 token's image by reading tokenURI() on-chain, fetching the
 * IPFS metadata JSON, and extracting the image field. Results are cached in KV
 * for 7 days since token images never change after deployment.
 */
export async function fetchTokenImage(env: Env, tokenAddress: string): Promise<string> {
  const cacheKey = `image:${tokenAddress.toLowerCase()}`;

  // KV cache hit
  const cached = await env.NETWORK_KV.get(cacheKey).catch(() => null);
  if (cached !== null) return cached;

  try {
    // 1. Call tokenURI() on the ERC20 via eth_call
    const rpcUrl = env.ALCHEMY_RPC || env.BASE_RPC;
    const rpcRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'eth_call',
        params: [{ to: tokenAddress, data: TOKEN_URI_SELECTOR }, 'latest'],
      }),
    });
    const rpcJson = await rpcRes.json() as { result?: string; error?: unknown };
    const raw = rpcJson.result;
    if (!raw || raw === '0x' || rpcJson.error) return '';

    // ABI-decode string: 32-byte offset, 32-byte length, then UTF-8 bytes
    const hex = raw.slice(2);
    const offsetWords = parseInt(hex.slice(0, 64), 16);
    const strStart = offsetWords * 2;
    const strLen = parseInt(hex.slice(strStart, strStart + 64), 16);
    if (strLen === 0) return '';
    const strHex = hex.slice(strStart + 64, strStart + 64 + strLen * 2);
    const tokenUri = new TextDecoder().decode(
      new Uint8Array(strHex.match(/.{2}/g)!.map((b) => parseInt(b, 16))),
    );
    if (!tokenUri) return '';

    // 2. Fetch IPFS metadata JSON — try each gateway until one responds
    let imageUri = '';
    const cid = tokenUri.startsWith('ipfs://') ? tokenUri.slice(7) : tokenUri;
    for (const gateway of IPFS_GATEWAYS) {
      const url = gateway + cid;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const metaRes = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!metaRes.ok) continue;
        const meta = await metaRes.json() as Record<string, unknown>;
        imageUri = String(meta.image ?? '');
        if (imageUri) break;
      } catch { /* try next gateway */ }
    }

    if (!imageUri) return '';

    // 3. Convert ipfs:// image URI to HTTP
    const imageCid = imageUri.startsWith('ipfs://') ? imageUri.slice(7) : imageUri;
    const imageUrl = IPFS_GATEWAYS[0] + imageCid;

    // Cache for 7 days — token images are immutable once deployed
    await env.NETWORK_KV.put(cacheKey, imageUrl, { expirationTtl: 604800 }).catch(() => {});
    return imageUrl;
  } catch {
    return '';
  }
}

/** Call Base RPC (JSON-RPC), preferring Alchemy for reliability */
async function rpcCall(env: Env, method: string, params: unknown[]): Promise<unknown> {
  const rpcUrl = env.ALCHEMY_RPC || env.BASE_RPC;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json() as Record<string, unknown>;
  return json.result;
}

/** ABI-encode a single Multicall3 Call3 struct */
function encodeCall3(target: string, callData: string): string {
  const targetPadded = target.toLowerCase().replace('0x', '').padStart(64, '0');
  const allowFailure = '0000000000000000000000000000000000000000000000000000000000000001';
  const dataOffset = '0000000000000000000000000000000000000000000000000000000000000060';
  const rawData = callData.replace('0x', '');
  const dataLen = (rawData.length / 2).toString(16).padStart(64, '0');
  const dataPadded = rawData.padEnd(Math.ceil(rawData.length / 64) * 64, '0');
  return targetPadded + allowFailure + dataOffset + dataLen + dataPadded;
}

/**
 * Batch-read claimable fees + ETH balances for all owners in 1 RPC call
 * via Multicall3.aggregate3.
 */
export async function batchReadBalances(
  env: Env,
  owners: string[],
): Promise<{ claimableMap: Map<string, number>; walletMap: Map<string, number> }> {
  const claimableMap = new Map<string, number>();
  const walletMap = new Map<string, number>();

  if (owners.length === 0) return { claimableMap, walletMap };

  try {
    const calls: Array<{ target: string; callData: string; owner: string; type: 'claimable' | 'eth' }> = [];

    for (const owner of owners) {
      const addrPadded = owner.toLowerCase().replace('0x', '').padStart(64, '0');
      calls.push({
        target: env.RM_ADDRESS,
        callData: BALANCES_SELECTOR + addrPadded,
        owner: owner.toLowerCase(),
        type: 'claimable',
      });
      calls.push({
        target: MULTICALL3,
        callData: GET_ETH_BALANCE_SELECTOR + addrPadded,
        owner: owner.toLowerCase(),
        type: 'eth',
      });
    }

    const numCalls = calls.length;
    const encodedCalls = calls.map((c) => encodeCall3(c.target, c.callData));

    const pointerSectionSize = numCalls * 32;
    let currentOffset = pointerSectionSize;
    const pointers: string[] = [];
    const elements: string[] = [];

    for (const encoded of encodedCalls) {
      pointers.push(currentOffset.toString(16).padStart(64, '0'));
      elements.push(encoded);
      currentOffset += encoded.length / 2;
    }

    const arrayLen = numCalls.toString(16).padStart(64, '0');
    const arrayOffset = '0000000000000000000000000000000000000000000000000000000000000020';
    const fullCalldata = AGGREGATE3_SELECTOR + arrayOffset + arrayLen + pointers.join('') + elements.join('');

    // Use Alchemy for reliability — public Base RPC often drops Multicall responses
    const rpcUrl = env.ALCHEMY_RPC || env.BASE_RPC;
    const rpcRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: MULTICALL3, data: fullCalldata }, 'latest'] }),
    });
    const rpcJson = await rpcRes.json() as Record<string, unknown>;
    const result = rpcJson.result as string;

    if (!result || result === '0x' || result.length < 10) {
      return { claimableMap, walletMap };
    }

    const dataHex = result.replace('0x', '');
    const arrOffset = parseInt(dataHex.slice(0, 64), 16) * 2;
    const arrLen = parseInt(dataHex.slice(arrOffset, arrOffset + 64), 16);

    const elemOffsets: number[] = [];
    for (let i = 0; i < arrLen; i++) {
      const offsetPos = arrOffset + 64 + i * 64;
      elemOffsets.push(parseInt(dataHex.slice(offsetPos, offsetPos + 64), 16) * 2);
    }

    for (let i = 0; i < Math.min(arrLen, calls.length); i++) {
      const elemStart = arrOffset + 64 + elemOffsets[i];
      const success = parseInt(dataHex.slice(elemStart, elemStart + 64), 16) === 1;
      if (!success) continue;

      const bytesOffset = parseInt(dataHex.slice(elemStart + 64, elemStart + 128), 16) * 2;
      const bytesStart = elemStart + bytesOffset;
      const bytesLen = parseInt(dataHex.slice(bytesStart, bytesStart + 64), 16);
      if (bytesLen === 0) continue;

      const valueHex = dataHex.slice(bytesStart + 64, bytesStart + 64 + bytesLen * 2);
      const value = Number(BigInt('0x' + (valueHex || '0'))) / 1e18;

      const call = calls[i];
      if (call.type === 'claimable') {
        claimableMap.set(call.owner, value);
      } else {
        walletMap.set(call.owner, value);
      }
    }
  } catch (err) {
    console.error('[balances] Multicall failed:', err instanceof Error ? err.message : String(err));
  }

  return { claimableMap, walletMap };
}

interface WalletTx {
  hash: string;
  to: string;
  value: number;
  timestamp: string;
  memo: string | null;
}

/**
 * Fetch recent outgoing txs for a wallet via Alchemy getAssetTransfers,
 * then decode memos from the tx calldata.
 */
export async function fetchWalletSwaps(
  env: Env,
  wallet: string,
  maxResults = 10,
): Promise<WalletTx[]> {
  try {
    const res = await fetch(env.ALCHEMY_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromAddress: wallet,
          category: ['external'],
          order: 'desc',
          maxCount: `0x${maxResults.toString(16)}`,
          withMetadata: true,
        }],
      }),
    });
    const json = await res.json() as Record<string, unknown>;
    const result = json.result as { transfers: Array<Record<string, unknown>> } | undefined;
    const transfers = result?.transfers ?? [];

    // Fetch tx input data for each to decode memos (batch)
    const txs: WalletTx[] = [];
    await Promise.allSettled(
      transfers.map(async (t) => {
        const hash = t.hash as string;
        const to = t.to as string;
        const value = (t.value as number) ?? 0;
        const metadata = t.metadata as { blockTimestamp: string };
        const memo = await fetchMemo(env, hash);
        txs.push({ hash, to, value, timestamp: metadata.blockTimestamp, memo });
      }),
    );

    // Sort by timestamp descending
    txs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return txs;
  } catch {
    return [];
  }
}

/**
 * Batch-fetch memos for multiple tx hashes in a single JSON-RPC batch request.
 * Returns a map of txHash -> decoded memo text.
 */
export async function batchFetchMemos(
  env: Env,
  txHashes: string[],
): Promise<Map<string, string>> {
  const memoMap = new Map<string, string>();
  if (txHashes.length === 0) return memoMap;

  const realHashes = txHashes;

  // Chunk into small batches to avoid RPC rate limits / response size issues
  const CHUNK_SIZE = 10;
  for (let start = 0; start < realHashes.length; start += CHUNK_SIZE) {
    const chunk = realHashes.slice(start, start + CHUNK_SIZE);
    try {
      const payload = chunk.map((hash, i) => ({
        jsonrpc: '2.0' as const,
        id: i,
        method: 'eth_getTransactionByHash',
        params: [hash],
      }));

      // Use Alchemy RPC for batch requests — public Base RPC often rejects batches
      const rpcUrl = env.ALCHEMY_RPC || env.BASE_RPC;
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.warn(`[batchFetchMemos] RPC returned ${res.status} for chunk at offset ${start}`);
        continue;
      }

      const results = await res.json() as any;

      if (!Array.isArray(results)) {
        console.warn(`[batchFetchMemos] RPC returned non-array for chunk at offset ${start}:`, results);
        continue;
      }

      for (const item of results) {
        const input = item.result?.input;
        if (!input || typeof input !== 'string') continue;

        const memo = decodeMemo(env, input);
        if (memo) {
          const hash = chunk[item.id];
          memoMap.set(hash, memo);
        }
      }
    } catch (err) {
      console.warn(`[batchFetchMemos] chunk at offset ${start} failed:`, err instanceof Error ? err.message : String(err));
    }
  }

  return memoMap;
}

/** Fetch a transaction's input data and decode any ANL memo */
export async function fetchMemo(
  env: Env,
  txHash: string,
): Promise<string | null> {
  try {
    const result = await rpcCall(env, 'eth_getTransactionByHash', [txHash]) as Record<string, unknown> | null;
    if (!result?.input || typeof result.input !== 'string') return null;
    return decodeMemo(env, result.input);
  } catch {
    return null;
  }
}

/** Extract ANL memo text from raw transaction calldata */
function decodeMemo(env: Env, calldata: string): string | null {
  const hex = calldata.toLowerCase().replace('0x', '');
  const prefixIdx = hex.lastIndexOf(env.MEMO_MAGIC_PREFIX.toLowerCase());

  if (prefixIdx === -1) return null;

  const payloadHex = hex.slice(prefixIdx + env.MEMO_MAGIC_PREFIX.length);
  if (payloadHex.length === 0 || payloadHex.length % 2 !== 0) return null;

  try {
    const bytes = new Uint8Array(payloadHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(payloadHex.slice(i * 2, i * 2 + 2), 16);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    // Extract the memo/reason text
    const text = String(parsed.reason ?? parsed.memo ?? parsed.note ?? '');
    return text || null;
  } catch {
    return null;
  }
}
