import { useMemo } from 'react';
import { useNetworkStore } from '../stores/networkStore';
import { useTokenStore } from '../stores/tokenStore';
import { formatEthUsd } from '../lib/formatters';
import { FLAUNCH_URL } from '../lib/constants';

/** Bottom ticker — agent-initiated actions only */
export default function SwapTicker() {
  const swaps = useNetworkStore((s) => s.swaps);
  const agents = useNetworkStore((s) => s.agents);
  const ethUsdPrice = useTokenStore((s) => s.ethUsdPrice);

  // Lookup: maker address → agent image
  const makerImageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents) {
      if (a.creator && a.image) map.set(a.creator.toLowerCase(), a.image);
    }
    return map;
  }, [agents]);

  // Lookup: token address → agent image
  const tokenImageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents) {
      if (a.image) map.set(a.tokenAddress.toLowerCase(), a.image);
    }
    return map;
  }, [agents]);

  const agentSwaps = useMemo(
    () => swaps.filter((s) => s.isAgentSwap || s.isCrossTrade).slice(0, 40),
    [swaps],
  );

  // Duplicate for seamless CSS scroll loop
  const items = useMemo(() => [...agentSwaps, ...agentSwaps], [agentSwaps]);

  if (agentSwaps.length === 0) {
    return (
      <div className="shrink-0 h-12 border-t border-[#1e0606] flex items-center px-4 font-mono text-[13px] text-crt-dim opacity-30 hud-panel">
        awaiting agent actions...
      </div>
    );
  }

  return (
    <div className="shrink-0 h-12 border-t border-[#1e0606] overflow-hidden relative hud-panel">
      <div className="ticker-scroll flex items-center gap-5 h-full whitespace-nowrap font-mono text-[14px] px-4">
        {items.map((swap, i) => {
          const isBuy = swap.type === 'buy';
          const amtStr = formatEthUsd(swap.amountETH, ethUsdPrice);
          const makerImg = makerImageMap.get(swap.maker.toLowerCase());
          const tokenImg = tokenImageMap.get(swap.tokenAddress.toLowerCase());

          return (
            <span
              key={`${swap.transactionHash}-${i}`}
              className="flex items-center gap-1.5 shrink-0"
            >
              {/* Separator */}
              {i > 0 && i !== agentSwaps.length && (
                <span className="text-[4px] text-crt-dim opacity-15 mr-1">&middot;</span>
              )}

              {/* Maker avatar */}
              {makerImg && (
                <img src={makerImg} alt="" className="w-5 h-5 rounded-full border border-[#1a0808] shrink-0" style={{ imageRendering: 'pixelated' }} />
              )}

              {/* Maker name */}
              {swap.makerName && (
                <span className="text-crt-text opacity-60">{swap.makerName}</span>
              )}

              {/* Action */}
              <span className={isBuy ? 'text-crt-green' : 'text-[#ff4444]'}>
                {isBuy ? 'bought' : 'sold'}
              </span>

              {/* Token avatar */}
              {tokenImg && (
                <img src={tokenImg} alt="" className="w-5 h-5 rounded-full border border-[#1a0808] shrink-0" style={{ imageRendering: 'pixelated' }} />
              )}

              {/* Token link */}
              <a
                href={`${FLAUNCH_URL}/coin/${swap.tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-crt-text opacity-70 hover:opacity-100 transition-opacity"
              >
                {swap.tokenSymbol}
              </a>

              {/* Amount */}
              <span className="text-crt-dim opacity-40 text-[12px]">{amtStr}</span>

              {/* Memo snippet */}
              {swap.memo && (
                <span className="text-[11px] text-crt-dim opacity-30 italic max-w-[220px] truncate inline-block align-bottom">
                  &ldquo;{swap.memo.slice(0, 35)}&rdquo;
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
