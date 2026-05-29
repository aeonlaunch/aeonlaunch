import { readFile, stat } from "node:fs/promises";
import {
  FLAUNCH_API_BASE,
  FLAUNCH_DATA_API_BASE,
  CHAIN,
  MAX_IMAGE_SIZE_BYTES,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
} from "./config.js";
import { UploadError, LaunchError, TimeoutError } from "./errors.js";
import type {
  Network,
  FlaunchUploadResponse,
  FlaunchLaunchResponse,
  FlaunchStatusResponse,
  FlaunchTokenListResponse,
  FlaunchTokenDetail,
  FlaunchTokenDetails,
  FlaunchHolder,
} from "../types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000 * (attempt + 1);
      await sleep(waitMs);
      continue;
    }

    return response;
  }

  throw new Error("Max retries exceeded (429 rate limit)");
}

/**
 * Upload image to IPFS via Flaunch Web2 API.
 * Accepts a file path or a {buffer, mime} object for generated images.
 */
export async function uploadImage(
  source: string | { buffer: Buffer; mime: string },
): Promise<string> {
  let base64: string;
  let mime: string;

  if (typeof source === "string") {
    const fileStat = await stat(source);
    if (fileStat.size > MAX_IMAGE_SIZE_BYTES) {
      throw new UploadError(`Image exceeds 5MB limit (${(fileStat.size / 1024 / 1024).toFixed(1)}MB)`);
    }

    const imageBuffer = await readFile(source);
    base64 = imageBuffer.toString("base64");

    const ext = source.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    mime = mimeMap[ext ?? ""] ?? "image/png";
  } else {
    base64 = source.buffer.toString("base64");
    mime = source.mime;
  }

  const dataUrl = `data:${mime};base64,${base64}`;

  const response = await fetchWithRetry(`${FLAUNCH_API_BASE}/api/v1/upload-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image: dataUrl }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new UploadError(`${response.status} — ${text}`);
  }

  const data = (await response.json()) as FlaunchUploadResponse;
  return data.ipfsHash;
}

/**
 * Launch a memecoin via Flaunch Web2 API.
 * This is gasless — Flaunch handles the on-chain transaction server-side.
 */
export async function launchMemecoin(params: {
  name: string;
  symbol: string;
  description: string;
  imageIpfs: string;
  creatorAddress: string;
  revenueManagerAddress?: string;
  websiteUrl?: string;
  network: Network;
}): Promise<string> {
  const chain = params.network === "testnet" ? CHAIN.testnet : CHAIN.mainnet;

  const body: Record<string, string | number | undefined> = {
    name: params.name,
    symbol: params.symbol,
    description: params.description,
    imageIpfs: params.imageIpfs,
    creatorAddress: params.creatorAddress,
    revenueManagerAddress: params.revenueManagerAddress,
    websiteUrl: params.websiteUrl,
    flaunchAt: 0, // immediate launch — avoids timestamp-in-the-past revert from relayer delay
  };

  // Strip undefined values so we don't send nulls to the API
  for (const key of Object.keys(body)) {
    if (body[key] === undefined) delete body[key];
  }

  const response = await fetchWithRetry(
    `${FLAUNCH_API_BASE}/api/v1/${chain.network}/launch-memecoin`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new LaunchError(`${response.status} — ${text}`);
  }

  const data = (await response.json()) as FlaunchLaunchResponse;
  return data.jobId;
}

/**
 * Fetch all tokens created by a specific wallet from the Flaunch V2 API.
 */
export async function fetchTokensByOwner(
  ownerAddress: string,
  network: Network,
): Promise<FlaunchTokenListResponse> {
  const chain = network === "testnet" ? CHAIN.testnet : CHAIN.mainnet;
  const url = `${FLAUNCH_DATA_API_BASE}/v2/${chain.network}/coins/top?creator=${ownerAddress}&limit=50`;

  const response = await fetchWithRetry(url, { method: "GET" });

  if (!response.ok) {
    if (response.status === 401) {
      return {
        data: [],
        pagination: { limit: 50, offset: 0 },
        meta: { network: chain.network, timestamp: Date.now() / 1000 },
      };
    }
    const text = await response.text();
    throw new Error(`Flaunch data API error: ${response.status} — ${text}`);
  }

  // V2 returns a direct array; wrap into the expected FlaunchTokenListResponse shape
  const coins = (await response.json()) as Array<{
    tokenAddress: string;
    symbol: string;
    name: string;
    image: string;
    marketCapETH: string;
  }>;

  const data = coins.map((c) => ({
    tokenAddress: c.tokenAddress,
    symbol: c.symbol,
    name: c.name,
    positionManager: "",
    marketCapETH: c.marketCapETH ?? "0",
    createdAt: 0,
    fairLaunchActive: false,
    image: c.image ?? "",
    description: "",
    video: null as null,
  }));

  return {
    data,
    pagination: { limit: 50, offset: 0 },
    meta: { network: chain.network, timestamp: Date.now() / 1000 },
  };
}

/**
 * Fetch a single token's detail (includes socials) from the Flaunch V2 API.
 */
export async function fetchToken(
  tokenAddress: string,
  network: Network,
): Promise<FlaunchTokenDetail> {
  const chain = network === "testnet" ? CHAIN.testnet : CHAIN.mainnet;
  const url = `${FLAUNCH_DATA_API_BASE}/v2/${chain.network}/coin/${tokenAddress}/details`;

  const response = await fetchWithRetry(url, { method: "GET" });

  if (!response.ok) {
    if (response.status === 401) {
      return {
        tokenAddress,
        symbol: "MOCK",
        name: "Mock Token",
        marketCapETH: "0",
        createdAt: 0,
        image: "",
        description: "Flaunch API requires API key",
        socials: {
          website: "",
          twitter: "",
          telegram: "",
          discord: "",
          farcaster: "",
        },
        meta: { network: chain.network, timestamp: Date.now() / 1000 },
      };
    }
    const text = await response.text();
    throw new Error(`Flaunch data API error: ${response.status} — ${text}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const socials = (data.socialLinks ?? {}) as Record<string, string>;
  const createdAtRaw = data.createdAt as string | number | undefined;
  const createdAt = typeof createdAtRaw === "string"
    ? Math.floor(new Date(createdAtRaw).getTime() / 1000)
    : (typeof createdAtRaw === "number" ? createdAtRaw : 0);

  return {
    tokenAddress: data.tokenAddress as string,
    symbol: data.symbol as string,
    name: data.name as string,
    marketCapETH: (data.marketCapETH ?? "0") as string,
    createdAt,
    image: (data.image ?? "") as string,
    description: (data.description ?? "") as string,
    socials: {
      website: socials.website ?? "",
      twitter: socials.twitter ?? socials.x ?? "",
      telegram: socials.telegram ?? "",
      discord: socials.discord ?? "",
      farcaster: socials.farcaster ?? "",
    },
    meta: { network: chain.network, timestamp: Date.now() / 1000 },
  };
}

/**
 * Fetch detailed token info (price, volume, creator) from the Flaunch V2 API.
 */
export async function fetchTokenDetails(
  tokenAddress: string,
  network: Network,
): Promise<FlaunchTokenDetails> {
  const chain = network === "testnet" ? CHAIN.testnet : CHAIN.mainnet;
  const url = `${FLAUNCH_DATA_API_BASE}/v2/${chain.network}/coin/${tokenAddress}/details`;

  const response = await fetchWithRetry(url, { method: "GET" });

  if (!response.ok) {
    if (response.status === 401) {
      return {
        tokenAddress,
        symbol: "MOCK",
        name: "Mock Token",
        image: "",
        description: "Flaunch API requires API key",
        marketCapETH: "0",
        priceChange24h: "0",
        volume24hETH: "0",
        creator: "",
        createdAt: 0,
      };
    }
    const text = await response.text();
    throw new Error(`Flaunch data API error: ${response.status} — ${text}`);
  }

  const data = (await response.json()) as Record<string, unknown>;

  if (!data?.tokenAddress || !data.name || !data.symbol) {
    throw new Error("Invalid token details response: missing required fields");
  }

  const createdAtRaw = data.createdAt as string | number | undefined;
  const createdAt = typeof createdAtRaw === "string"
    ? Math.floor(new Date(createdAtRaw).getTime() / 1000)
    : (typeof createdAtRaw === "number" ? createdAtRaw : 0);

  return {
    tokenAddress: data.tokenAddress as string,
    symbol: data.symbol as string,
    name: data.name as string,
    image: (data.image ?? "") as string,
    description: (data.description ?? "") as string,
    marketCapETH: (data.marketCapETH ?? "0") as string,
    priceChange24h: String(data.twentyFourHourChangePercentage ?? data.priceChange24hPercentage ?? "0"),
    volume24hETH: (data.twentyFourHourVolume ?? data.volume24hETH ?? "0") as string,
    creator: (data.creator ?? data.owner ?? "") as string,
    createdAt,
  };
}

/**
 * Fetch the number of unique holders for a token from the Flaunch V2 API.
 */
export async function fetchTokenHolderCount(
  tokenAddress: string,
  network: Network,
): Promise<number> {
  const chain = network === "testnet" ? CHAIN.testnet : CHAIN.mainnet;
  const url = `${FLAUNCH_DATA_API_BASE}/v2/${chain.network}/coin/${tokenAddress}/holders?limit=1&offset=0`;

  const response = await fetchWithRetry(url, { method: "GET" });

  if (!response.ok) {
    if (response.status === 401) {
      return 0;
    }
    const text = await response.text();
    throw new Error(`Flaunch data API error: ${response.status} — ${text}`);
  }

  const data = (await response.json()) as { data: FlaunchHolder[]; pagination: { totalCount?: number; total?: number; limit: number; offset: number } };

  const total = data.pagination?.totalCount ?? data.pagination?.total;
  if (typeof total === "number") return total;

  throw new Error("Holder count unavailable: API response missing pagination.totalCount");
}

/**
 * Poll launch status until completed or failed.
 */
export async function pollLaunchStatus(
  jobId: string,
  onPoll?: (state: string, position: number) => void,
): Promise<FlaunchStatusResponse> {
  const startTime = Date.now();

  let consecutiveErrors = 0;

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    let response: Response;
    try {
      response = await fetch(`${FLAUNCH_API_BASE}/api/v1/launch-status/${jobId}`);
    } catch {
      // Network error — retry up to 5 times before giving up
      consecutiveErrors++;
      if (consecutiveErrors >= 5) {
        throw new LaunchError("Lost connection to Flaunch API during deployment");
      }
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      consecutiveErrors++;
      if (consecutiveErrors >= 5) {
        throw new LaunchError(`Status check failed after retries: ${response.status}`);
      }
      await sleep(POLL_INTERVAL_MS * (consecutiveErrors + 1));
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new LaunchError(`Status check failed: ${response.status} — ${text}`);
    }

    consecutiveErrors = 0;
    const data = (await response.json()) as FlaunchStatusResponse;
    onPoll?.(data.state, data.queuePosition);

    if (data.state === "completed") return data;
    if (data.state === "failed") {
      throw new LaunchError(data.error ?? "Launch failed with no error message");
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new TimeoutError();
}
