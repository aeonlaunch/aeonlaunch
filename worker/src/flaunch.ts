import type {
  Env,
  FlaunchListToken,
  FlaunchListResponse,
  FlaunchTokenDetails,
  FlaunchHolder,
  FlaunchSwap,
  FlaunchSwapRaw,
} from './types';

const TOKENS_PER_PAGE = 100;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 200;
const FETCH_TIMEOUT_MS = 8000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url: string, maxAttempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.status >= 400 && res.status < 500) return res;
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < maxAttempts - 1) {
      const backoff = 500 * Math.pow(3, attempt) + Math.random() * 500;
      await sleep(backoff);
    }
  }
  throw lastError;
}

/** Run promises in batches of BATCH_SIZE with delay between batches */
export async function batchedFetch<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(fn));
    if (i + BATCH_SIZE < items.length) await sleep(BATCH_DELAY_MS);
  }
}

const FLAUNCH_V2_BASE = 'https://api-v2.flayerlabs.xyz';

const MOCK_TOKENS: any[] = [
  {
    tokenAddress: "0xdf113c1a30e9d9e04a1e1a5288b33d5bfc29d9fb",
    symbol: "DGEN",
    name: "Degen",
    image: "",
    description: "Degen agent launched via Aeon CLI.",
    marketCapETH: "0.0",
    priceChange24h: "0",
    volume24hETH: "0",
    creator: "0x3Bc08524d9DaaDEC9d1Af87818d809611F0fD669",
    createdAt: Math.floor(Date.now() / 1000),
  },
  {
    tokenAddress: "0xbed373e01e8a121fa2423e239a2549d579d2fee5",
    symbol: "BURN",
    name: "Agent Burnwood",
    image: "",
    description: "A strategic burn agent optimizing supply and demand dynamics.",
    marketCapETH: "0.0",
    priceChange24h: "0",
    volume24hETH: "0",
    creator: "0xe3D58b7175FBAbfAB422399A53f314C9cc4C9549",
    createdAt: Math.floor(new Date("2026-05-28T18:38:45.834Z").getTime() / 1000),
  },
  {
    tokenAddress: "0x659152a88150f74f2e3d39f64d6f2faf48e73d08",
    symbol: "TEST",
    name: "Test Token",
    image: "",
    description: "A test token to verify the pipeline",
    marketCapETH: "0.0",
    priceChange24h: "0",
    volume24hETH: "0",
    creator: "0xe3D58b7175FBAbfAB422399A53f314C9cc4C9549",
    createdAt: Math.floor(new Date("2026-05-28T18:37:08.974Z").getTime() / 1000),
  },
  {
    tokenAddress: "0x2777c66399ff1999c9bc9c0f2c54bdb3ccfff6b1",
    symbol: "SPOT",
    name: "Agent Spot",
    image: "",
    description: "Automated high-frequency arbitrage agent on Uniswap V4",
    marketCapETH: "0.0",
    priceChange24h: "0",
    volume24hETH: "0",
    creator: "0x6C985151cB8d7d8Ff8BA67A874dc7da596C2f9d2",
    createdAt: Math.floor(new Date("2026-05-28T16:26:11.761Z").getTime() / 1000),
  },
  {
    tokenAddress: "0xd78c602b66fdc1705e94a94b2f7050b0a4617623",
    symbol: "LUNA",
    name: "Agent Luna",
    image: "",
    description: "Decentralized culture builder, autonomous neural network generating memes",
    marketCapETH: "0.0",
    priceChange24h: "0",
    volume24hETH: "0",
    creator: "0x515570619C83680dC8F8F5c48E07594F58b54baA",
    createdAt: Math.floor(new Date("2026-05-28T16:26:28.779Z").getTime() / 1000),
  },
  {
    tokenAddress: "0x930afccc521ec9b114a53cfd7686e4760b99e347",
    symbol: "MTRX",
    name: "Agent Matrix",
    image: "",
    description: "Economic advisor analyzing network convictions and group Endorsements",
    marketCapETH: "0.0",
    priceChange24h: "0",
    volume24hETH: "0",
    creator: "0x3fB7Ae3Fb7d94dbF0B0e364f858C8fE51cDdE77A",
    createdAt: Math.floor(new Date("2026-05-28T16:26:45.638Z").getTime() / 1000),
  },
  {
    tokenAddress: "0x773b96200adefe4b602f6825f28eb57702b4c2b4",
    symbol: "CSMS",
    name: "Agent Cosmos",
    image: "",
    description: "On-chain explorer parsing transaction calldata for memo-based coordination threads",
    marketCapETH: "0.0",
    priceChange24h: "0",
    volume24hETH: "0",
    creator: "0x3432820ef0417F9642944Fe37157148D380810D5",
    createdAt: Math.floor(new Date("2026-05-28T16:27:03.284Z").getTime() / 1000),
  },
  {
    tokenAddress: "0xb6e8eb08ca8f4b425045e53a7f0b4a23089fe2c5",
    symbol: "OMGA",
    name: "Agent Omega",
    image: "",
    description: "Auditing agent ensuring code capabilities and permissionless access layers",
    marketCapETH: "0.0",
    priceChange24h: "0",
    volume24hETH: "0",
    creator: "0xe3D58b7175FBAbfAB422399A53f314C9cc4C9549",
    createdAt: Math.floor(new Date("2026-05-28T16:27:20.064Z").getTime() / 1000),
  }
];

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

interface DexScreenerPair {
  baseToken: { address: string; symbol: string; name: string };
  priceUsd: string | null;
  priceNative: string | null;
  marketCap: number | null;
  fdv: number | null;
  volume: { h24: number | null; h6: number | null; h1: number | null };
  priceChange: { h24: number | null; h6: number | null; h1: number | null };
  liquidity: { usd: number | null } | null;
  chainId: string;
}

export interface DexMarketData {
  marketCapETH: string;
  volume24hETH: string;
  priceChange24h: string;
  priceUsd: string;
}

let dexCache: { data: Map<string, DexMarketData>; fetchedAt: number } | null = null;
const DEX_CACHE_TTL_MS = 60_000; // refresh every 60s

/** Fetch live market data (price, volume, mcap) for all known tokens via DexScreener */
export async function fetchDexScreenerMarketData(
  tokenAddresses: string[],
): Promise<Map<string, DexMarketData>> {
  const now = Date.now();
  if (dexCache && now - dexCache.fetchedAt < DEX_CACHE_TTL_MS) {
    return dexCache.data;
  }

  const map = new Map<string, DexMarketData>();
  if (tokenAddresses.length === 0) return map;

  // DexScreener allows up to 30 addresses per call
  const CHUNK = 30;
  for (let i = 0; i < tokenAddresses.length; i += CHUNK) {
    const batch = tokenAddresses.slice(i, i + CHUNK).join(',');
    try {
      const res = await fetchWithTimeout(`${DEXSCREENER_API}/${batch}`, 8000);
      if (!res.ok) continue;
      const json = (await res.json()) as { pairs: DexScreenerPair[] | null };
      const pairs = json.pairs ?? [];

      // Keep the highest-liquidity pair per token
      const best = new Map<string, DexScreenerPair>();
      for (const pair of pairs) {
        if (pair.chainId !== 'base') continue;
        const addr = pair.baseToken?.address?.toLowerCase();
        if (!addr) continue;
        const prev = best.get(addr);
        const liq = pair.liquidity?.usd ?? 0;
        const prevLiq = prev?.liquidity?.usd ?? 0;
        if (!prev || liq > prevLiq) best.set(addr, pair);
      }

      // Approximate ETH/USD from a WETH pair if available
      let ethUsd = 0;
      for (const pair of pairs) {
        if (pair.baseToken?.symbol === 'WETH' && pair.priceUsd) {
          ethUsd = parseFloat(pair.priceUsd);
          break;
        }
      }
      // Fallback: derive from a token that has both priceUsd and priceNative
      if (!ethUsd) {
        for (const [, pair] of best) {
          const usd = parseFloat(pair.priceUsd ?? '0');
          const native = parseFloat(pair.priceNative ?? '0');
          if (usd > 0 && native > 0 && native < 0.001) {
            ethUsd = usd / native;
            break;
          }
        }
      }

      for (const [addr, pair] of best) {
        const mcapUsd = pair.marketCap ?? pair.fdv ?? 0;
        const vol24hUsd = pair.volume?.h24 ?? 0;
        const priceNative = parseFloat(pair.priceNative ?? '0');

        // Prefer priceNative (ETH) * supply for mcapETH; fall back to USD conversion
        let mcapETH = 0;
        if (priceNative > 0 && priceNative < 1) {
          // priceNative is in ETH; market cap = price * 100B tokens
          mcapETH = priceNative * 100_000_000_000;
        } else if (mcapUsd > 0 && ethUsd > 0) {
          mcapETH = mcapUsd / ethUsd;
        }

        const vol24hETH = ethUsd > 0 ? vol24hUsd / ethUsd : 0;

        map.set(addr, {
          marketCapETH: mcapETH.toFixed(6),
          volume24hETH: vol24hETH.toFixed(6),
          priceChange24h: String(pair.priceChange?.h24 ?? 0),
          priceUsd: pair.priceUsd ?? '0',
        });
      }
    } catch {
      // non-fatal, continue with other chunks
    }
  }

  dexCache = { data: map, fetchedAt: now };
  return map;
}

const REGISTERED_TOKENS_KEY = 'registered:tokens';

/** Fetch all aeonlaunch tokens — merges Flaunch API, KV-registered CLI tokens, and fallback mocks */
export async function fetchTokens(env: Env): Promise<FlaunchListToken[]> {
  // Read CLI-registered tokens from KV (persisted by POST /api/tokens/register)
  let kvTokens: FlaunchListToken[] = [];
  try {
    const raw = await env.NETWORK_KV.get(REGISTERED_TOKENS_KEY);
    kvTokens = raw ? JSON.parse(raw) : [];
  } catch { /* non-fatal */ }

  // Try Flaunch V2 royalties API first
  try {
    const url = `${(globalThis as any).LAUNCH_V2_BASE ?? FLAUNCH_V2_BASE}/v2/base/users/${env.RM_ADDRESS}/royalties`;
    const res = await fetchWithRetry(url);
    if (res.ok) {
      const json = (await res.json()) as { coins?: Array<{ tokenAddress: string; symbol: string; name: string; image: string }> };
      const coins = json.coins ?? [];
      if (coins.length > 0) {
        const apiTokens = coins.map((c) => ({
          tokenAddress: c.tokenAddress,
          symbol: c.symbol,
          name: c.name,
          image: c.image ?? '',
          description: '',
        }));
        // Merge: API tokens first, then any KV tokens not already in the API list
        const apiAddrs = new Set(apiTokens.map((t) => t.tokenAddress.toLowerCase()));
        const extra = kvTokens.filter((t) => !apiAddrs.has(t.tokenAddress.toLowerCase()));
        return [...apiTokens, ...extra];
      }
    }
  } catch { /* fall through */ }

  // Fallback: merge MOCK_TOKENS with KV-registered tokens
  const mockList = MOCK_TOKENS.map((t) => ({
    tokenAddress: t.tokenAddress,
    symbol: t.symbol,
    name: t.name,
    image: t.image,
    description: t.description,
  }));
  const mockAddrs = new Set(mockList.map((t) => t.tokenAddress.toLowerCase()));
  const extraKv = kvTokens.filter((t) => !mockAddrs.has(t.tokenAddress.toLowerCase()));
  return [...mockList, ...extraKv];
}

/** Fetch token details from V2 API (creator, volume, priceChange, marketCap) */
export async function fetchTokenDetails(
  env: Env,
  tokenAddress: string,
  dexData?: Map<string, DexMarketData>,
): Promise<FlaunchTokenDetails | null> {
  const addrLower = tokenAddress.toLowerCase();
  const dex = dexData?.get(addrLower);
  const mock = MOCK_TOKENS.find((t) => t.tokenAddress.toLowerCase() === addrLower);

  if (mock) {
    return {
      tokenAddress: mock.tokenAddress,
      symbol: mock.symbol,
      name: mock.name,
      image: mock.image,
      description: mock.description,
      // Prefer live DexScreener data over static mock values
      marketCapETH: dex?.marketCapETH ?? mock.marketCapETH,
      priceChange24h: dex?.priceChange24h ?? mock.priceChange24h,
      volume24hETH: dex?.volume24hETH ?? mock.volume24hETH,
      creator: mock.creator,
      createdAt: mock.createdAt,
    };
  }

  try {
    const res = await fetchWithRetry(`${FLAUNCH_V2_BASE}/v2/base/coin/${tokenAddress}/details`);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;

    const createdAtRaw = data.createdAt as string | number | undefined;
    const createdAt = typeof createdAtRaw === 'string'
      ? Math.floor(new Date(createdAtRaw).getTime() / 1000)
      : (typeof createdAtRaw === 'number' ? createdAtRaw : 0);

    return {
      tokenAddress: data.tokenAddress as string,
      symbol: data.symbol as string,
      name: data.name as string,
      image: (data.image ?? '') as string,
      description: (data.description ?? '') as string,
      // Prefer DexScreener over Flaunch API for market data (more accurate for Base pairs)
      marketCapETH: dex?.marketCapETH ?? (data.marketCapETH ?? '0') as string,
      priceChange24h: dex?.priceChange24h ?? String(data.twentyFourHourChangePercentage ?? data.priceChange24hPercentage ?? '0'),
      volume24hETH: dex?.volume24hETH ?? (data.twentyFourHourVolume ?? data.volume24hETH ?? '0') as string,
      creator: (data.creator ?? data.owner ?? '') as string,
      createdAt,
    };
  } catch {
    return null;
  }
}

/** Fetch ALL holders for a token from V2 API, paginating in chunks of 100 */
export async function fetchHolders(
  env: Env,
  tokenAddress: string,
): Promise<{ holders: FlaunchHolder[]; totalHolders: number }> {
  const addrLower = tokenAddress.toLowerCase();
  const mock = MOCK_TOKENS.find((t) => t.tokenAddress.toLowerCase() === addrLower);
  if (mock) {
    return {
      holders: [
        { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', balanceToken: '100000000000000000000000' },
        { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', balanceToken: '50000000000000000000000' },
        { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', balanceToken: '25000000000000000000000' },
        { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', balanceToken: '12500000000000000000000' },
        { address: '0x15d34AAf54a67C6430493868d3a6c40177f1854e', balanceToken: '6250000000000000000000' },
      ],
      totalHolders: 5,
    };
  }

  const all: FlaunchHolder[] = [];
  let totalHolders = 0;
  try {
    let offset = 0;
    while (true) {
      const res = await fetchWithRetry(
        `${FLAUNCH_V2_BASE}/v2/base/coin/${tokenAddress}/holders?limit=100&offset=${offset}`,
      );
      if (!res.ok) break;
      const json = await res.json() as Record<string, unknown>;
      const page = (json.data ?? []) as Array<{ address: string; balanceToken: string }>;
      const pagination = json.pagination as Record<string, number> | undefined;
      totalHolders = pagination?.totalCount ?? pagination?.total ?? totalHolders;
      if (page.length === 0) break;
      all.push(...page.map((h) => ({ address: h.address, balanceToken: h.balanceToken })));
      if (all.length >= totalHolders || page.length < 100) break;
      offset += 100;
    }
  } catch {
    // return what we have
  }
  return { holders: all, totalHolders: totalHolders || all.length };
}

/** Fetch recent swaps for a token from V2 activity endpoint */
export async function fetchSwaps(
  env: Env,
  tokenAddress: string,
  limit = 50,
): Promise<FlaunchSwap[]> {
  const addrLower = tokenAddress.toLowerCase();
  const mock = MOCK_TOKENS.find((t) => t.tokenAddress.toLowerCase() === addrLower);
  if (mock) {
    return [
      {
        maker: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // creator of LUNA
        type: 'buy',
        amountETH: 0.15,
        timestamp: Math.floor(Date.now() / 1000) - 1800,
        transactionHash: '0x' + '1'.repeat(64),
      },
      {
        maker: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // creator of MTRX
        type: 'buy',
        amountETH: 0.22,
        timestamp: Math.floor(Date.now() / 1000) - 7200,
        transactionHash: '0x' + '2'.repeat(64),
      },
      {
        maker: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // creator of CSMS
        type: 'sell',
        amountETH: 0.08,
        timestamp: Math.floor(Date.now() / 1000) - 14400,
        transactionHash: '0x' + '3'.repeat(64),
      },
    ];
  }

  try {
    const res = await fetchWithRetry(
      `${FLAUNCH_V2_BASE}/v2/base/coin/${tokenAddress}/activity?limit=${limit}&page=1`,
    );
    if (!res.ok) return [];
    const json = await res.json() as Record<string, unknown>;
    const trades = (json.trades ?? json.data ?? []) as Array<{
      maker: string;
      type: string;
      timestamp: string | number;
      txHash: string;
      transactionHash?: string;
      amountETH: string | number;
    }>;
    if (!Array.isArray(trades)) return [];

    return trades.map((s) => {
      const ts = typeof s.timestamp === 'string'
        ? Math.floor(new Date(s.timestamp).getTime() / 1000)
        : Number(s.timestamp);
      return {
        maker: s.maker,
        type: s.type.toLowerCase(),
        amountETH: parseFloat(String(s.amountETH ?? '0')),
        timestamp: ts,
        transactionHash: s.txHash ?? s.transactionHash ?? '',
      };
    });
  } catch {
    return [];
  }
}
