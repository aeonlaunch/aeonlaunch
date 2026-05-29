import {
  REVENUE_MANAGER_ADDRESS,
  FLAUNCH_DATA_API,
  FLAUNCH_URL,
  WORKER_API_URL,
  UNISWAP_URL,
  BASE_RPC,
  MEMO_MAGIC_PREFIX,
} from "@aeonlaunch/shared";

export const RM_ADDRESS = REVENUE_MANAGER_ADDRESS;
export { FLAUNCH_DATA_API, FLAUNCH_URL, UNISWAP_URL, BASE_RPC, MEMO_MAGIC_PREFIX };

// If in development mode and window is available, use relative path to hit Vite proxy
export const NETWORK_API = typeof window !== 'undefined' && window.location.hostname !== 'network.aeonlaunch.fun'
  ? ''
  : WORKER_API_URL;

// Site-specific constants (not shared with CLI/worker)
export const PER_PAGE = 20;
export const TOKENS_PER_PAGE = 100;
export const SWAP_POLL_INTERVAL = 60_000;
export const FULL_REFRESH_INTERVAL = 120_000;
