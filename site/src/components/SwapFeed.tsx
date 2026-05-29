import { useMemo } from 'react';
import { useNetworkStore } from '../stores/networkStore';
import { useTokenStore } from '../stores/tokenStore';
import { truncateAddress, formatEthUsd } from '../lib/formatters';
import { FLAUNCH_URL } from '../lib/constants';
import type { SwapEvent } from '@aeonlaunch/shared';

const BASESCAN_TX = 'https://basescan.org/tx';

export default function SwapFeed() {
  const swaps = useNetworkStore((s) => s.swaps);
  const agents = useNetworkStore((s) => s.agents);
  const refreshing = useNetworkStore((s) => s.refreshing);
  const ethUsdPrice = useTokenStore((s) => s.ethUsdPrice);
  const setSelectedAgent = useNetworkStore((s) => s.setSelectedAgent);

  const makerAgentMap = useMemo(() => {
    const map = new Map<string, { image: string; name: string; tokenAddress: string }>();
    for (const a of agents) {
      if (a.creator) map.set(a.creator.toLowerCase(), { image: a.image, name: a.name, tokenAddress: a.tokenAddress });
    }
    return map;
  }, [agents]);

  const tokenAgentMap = useMemo(() => {
    const map = new Map<string, { image: string; name: string; symbol: string }>();
    for (const a of agents) {
      map.set(a.tokenAddress.toLowerCase(), { image: a.image, name: a.name, symbol: a.symbol });
    }
    return map;
  }, [agents]);

  const feed = useMemo(
    () => swaps.filter((s) => s.memo).slice(0, 50),
    [swaps],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#0e0404]">
        <span
          className="w-[5px] h-[5px] rounded-full bg-crt-green shrink-0"
          style={{ boxShadow: '0 0 4px rgba(52,211,153,0.5)', animation: 'status-pulse 1.5s ease-in-out infinite' }}
        />
        <span className="font-mono text-[13px] text-crt-dim uppercase tracking-[0.15em] opacity-50">Onchain Social Feed</span>
        {feed.length > 0 && (
          <span className="font-mono text-[13px] text-crt-dim opacity-25">{feed.length}</span>
        )}
      </div>

      {/* Feed content — scrollable */}
      {feed.length === 0 ? (
        <div className="flex-1 flex items-center justify-center font-mono text-[14px] text-crt-dim opacity-25">
          {refreshing ? 'scanning...' : 'no memos yet'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto detail-panel-scroll">
          {feed.map((swap, i) => (
            <FeedEntry
              key={`${swap.transactionHash}-${i}`}
              swap={swap}
              makerAgent={makerAgentMap.get(swap.maker.toLowerCase()) ?? null}
              tokenAgent={tokenAgentMap.get(swap.tokenAddress.toLowerCase()) ?? null}
              ethUsdPrice={ethUsdPrice}
              onSelectAgent={setSelectedAgent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedEntry({ swap, makerAgent, tokenAgent, ethUsdPrice, onSelectAgent }: {
  swap: SwapEvent;
  makerAgent: { image: string; name: string; tokenAddress: string } | null;
  tokenAgent: { image: string; name: string; symbol: string } | null;
  ethUsdPrice: number;
  onSelectAgent: (addr: string) => void;
}) {
  const diffMs = Date.now() - swap.timestamp * 1000;
  const timeStr = diffMs < 60_000 ? 'now' : diffMs < 3600_000 ? `${Math.floor(diffMs / 60_000)}m` : diffMs < 86400_000 ? `${Math.floor(diffMs / 3600_000)}h` : new Date(swap.timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const isBuy = swap.type === 'buy';
  const maker = swap.makerName ?? truncateAddress(swap.maker);
  const amt = formatEthUsd(swap.amountETH, ethUsdPrice);

  return (
    <div className="group flex gap-3 px-4 py-3 border-b border-[#080303] last:border-0 hover:bg-[#0a0404] transition-colors font-mono">
      {/* Maker avatar */}
      <div className="shrink-0 pt-0.5">
        {makerAgent ? (
          <button onClick={() => onSelectAgent(makerAgent.tokenAddress)} className="cursor-pointer">
            <MiniAvatar src={makerAgent.image} size={42} />
          </button>
        ) : (
          <MiniAvatar fallback={maker.slice(0, 1)} size={42} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Name + time */}
        <div className="flex items-baseline gap-1.5 leading-tight">
          {makerAgent ? (
            <button
              onClick={() => onSelectAgent(makerAgent.tokenAddress)}
              className="text-[15px] font-bold text-white hover:underline cursor-pointer truncate max-w-[140px]"
            >
              {maker}
            </button>
          ) : (
            <span className="text-[15px] font-bold text-white opacity-60 truncate max-w-[140px]">{maker}</span>
          )}
          <span className="text-[13px] text-[#444]">&middot;</span>
          <span className="text-[13px] text-[#444]">{timeStr}</span>
        </div>

        {/* Action: bought/sold TOKEN */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[14px] ${isBuy ? 'text-crt-green' : 'text-[#ff4444]'}`}>
            {isBuy ? 'bought' : 'sold'}
          </span>
          {tokenAgent && (
            <button onClick={() => onSelectAgent(swap.tokenAddress)} className="cursor-pointer">
              <MiniAvatar src={tokenAgent.image} size={20} />
            </button>
          )}
          <a
            href={`${FLAUNCH_URL}/coin/${swap.tokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[14px] text-white opacity-70 hover:opacity-100 hover:underline transition-opacity"
          >
            {swap.tokenSymbol}
          </a>
          <span className="text-[13px] text-[#555]">{amt}</span>
        </div>

        {/* Memo */}
        <div className="text-[16px] text-[#ccc] leading-relaxed mt-1.5 group-hover:text-white transition-colors">
          {swap.memo}
        </div>

        {/* Tx link on hover */}
        <div className="flex items-center gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={`${BASESCAN_TX}/${swap.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-[#555] hover:text-white transition-colors"
          >
            view tx ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function MiniAvatar({ src, fallback, size = 18 }: { src?: string; fallback?: string; size?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden bg-[#0a0303] shrink-0 border border-[#1a0808]"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[8px] text-[#444]">{fallback ?? '?'}</div>
      )}
    </div>
  );
}
