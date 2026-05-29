import { useMemo } from 'react';
import { useNetworkStore } from '../stores/networkStore';
import { useTokenStore } from '../stores/tokenStore';
import { formatEthUsd } from '../lib/formatters';
import type { NetworkAgent as Agent, SwapEvent } from '@aeonlaunch/shared';

/** Full memo feed for the currently selected agent */
export default function AgentMemoFeed() {
  const selectedAgent = useNetworkStore((s) => s.selectedAgent);
  const agents = useNetworkStore((s) => s.agents);
  const swaps = useNetworkStore((s) => s.swaps);
  const setSelectedAgent = useNetworkStore((s) => s.setSelectedAgent);
  const ethUsdPrice = useTokenStore((s) => s.ethUsdPrice);

  const agent = useMemo(
    () => agents.find((a) => a.tokenAddress === selectedAgent),
    [agents, selectedAgent],
  );

  const agentByCreator = useMemo(() => {
    const map = new Map<string, typeof agents[number]>();
    for (const a of agents) {
      if (a.creator) map.set(a.creator.toLowerCase(), a);
    }
    return map;
  }, [agents]);

  const agentByToken = useMemo(() => {
    const map = new Map<string, typeof agents[number]>();
    for (const a of agents) map.set(a.tokenAddress.toLowerCase(), a);
    return map;
  }, [agents]);

  const memos = useMemo(() => {
    if (!agent) return [];
    const ownerLower = agent.creator.toLowerCase();
    const tokenLower = agent.tokenAddress.toLowerCase();
    const seen = new Set<string>();
    const entries: Array<{
      swap: SwapEvent;
      kind: 'self' | 'cross' | 'external';
      otherAgent: Agent | null;
    }> = [];

    for (const s of swaps) {
      if (!s.memo || seen.has(s.transactionHash)) continue;
      const isAbout = s.tokenAddress.toLowerCase() === tokenLower;
      const isBy = s.maker.toLowerCase() === ownerLower;
      if (!isAbout && !isBy) continue;

      seen.add(s.transactionHash);

      let kind: 'self' | 'cross' | 'external';
      let otherAgent: Agent | null = null;

      if (isBy && isAbout) {
        kind = 'self';
      } else if (isBy) {
        kind = 'self';
        otherAgent = agentByToken.get(s.tokenAddress.toLowerCase()) ?? null;
      } else if (isAbout) {
        const makerAgent = agentByCreator.get(s.maker.toLowerCase());
        if (makerAgent) {
          kind = 'cross';
          otherAgent = makerAgent;
        } else {
          kind = 'external';
        }
      } else {
        kind = 'external';
      }

      entries.push({ swap: s, kind, otherAgent });
    }
    return entries;
  }, [swaps, agent, agentByCreator, agentByToken]);

  if (!agent) return null;

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-[#060101]/80 px-4 py-3 border-b border-[#1a0808]">
        <span className="text-[13px] font-bold text-[#e7e9ea]">Memos</span>
        {memos.length > 0 && (
          <span className="ml-2 text-[11px] text-[#555]">{memos.length}</span>
        )}
      </div>

      {/* Memo list */}
      {memos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center font-mono text-[12px] text-crt-dim opacity-25">
          no memos yet
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto detail-panel-scroll">
          {memos.map(({ swap, kind, otherAgent }, i) => (
            <MemoEntry
              key={`${swap.transactionHash}-${i}`}
              swap={swap}
              kind={kind}
              otherAgent={otherAgent}
              agent={agent}
              onSelectAgent={setSelectedAgent}
              ethUsdPrice={ethUsdPrice}
            />
          ))}
        </div>
      )}
    </>
  );
}

function MemoEntry({ swap, kind, otherAgent, agent, onSelectAgent, ethUsdPrice }: {
  swap: SwapEvent;
  kind: 'self' | 'cross' | 'external';
  otherAgent: Agent | null;
  agent: Agent;
  onSelectAgent: (addr: string) => void;
  ethUsdPrice: number;
}) {
  const diffMs = Date.now() - swap.timestamp * 1000;
  const time = diffMs < 60_000 ? 'now' : diffMs < 3600_000 ? `${Math.floor(diffMs / 60_000)}m` : diffMs < 86400_000 ? `${Math.floor(diffMs / 3600_000)}h` : `${Math.floor(diffMs / 86400_000)}d`;

  let author: { name: string; handle: string; image: string; addr?: string };
  let target: { name: string; image: string; addr?: string } | null = null;

  if (kind === 'self') {
    author = { name: agent.name, handle: `$${agent.symbol}`, image: agent.image };
    if (otherAgent) {
      target = { name: otherAgent.name, image: otherAgent.image, addr: otherAgent.tokenAddress };
    }
  } else if (kind === 'cross' && otherAgent) {
    author = { name: otherAgent.name, handle: `$${otherAgent.symbol}`, image: otherAgent.image, addr: otherAgent.tokenAddress };
    target = { name: agent.name, image: agent.image };
  } else {
    const shortAddr = swap.maker.slice(0, 6) + '…' + swap.maker.slice(-4);
    author = { name: swap.makerName ?? shortAddr, handle: shortAddr, image: '' };
    target = { name: agent.name, image: agent.image };
  }

  const actionColor = swap.type === 'buy' ? '#34d399' : '#ff4444';
  const actionLabel = swap.type === 'buy' ? 'bought' : 'sold';

  return (
    <div className="flex gap-2.5 px-4 py-3 border-b border-[#141414] hover:bg-[#080404] transition-colors font-mono">
      {/* Avatar */}
      <div className="shrink-0 pt-0.5">
        {author.addr ? (
          <button onClick={(e) => { e.stopPropagation(); onSelectAgent(author.addr!); }} className="cursor-pointer">
            <MiniAvatar src={author.image || undefined} fallback={author.name.slice(0, 1)} size={32} />
          </button>
        ) : (
          <MiniAvatar src={author.image || undefined} fallback={author.name.slice(0, 1)} size={32} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1 leading-tight">
          {author.addr ? (
            <button
              onClick={(e) => { e.stopPropagation(); onSelectAgent(author.addr!); }}
              className="text-[12px] font-bold text-[#e7e9ea] hover:underline cursor-pointer truncate max-w-[120px]"
            >
              {author.name}
            </button>
          ) : (
            <span className="text-[12px] font-bold text-[#e7e9ea] truncate max-w-[120px]">{author.name}</span>
          )}
          <span className="text-[11px] text-[#555] truncate max-w-[80px]">{author.handle}</span>
          <span className="text-[11px] text-[#555]">·</span>
          <span className="text-[11px] text-[#555] shrink-0">{time}</span>
        </div>

        {/* Action line */}
        {target ? (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] uppercase font-bold" style={{ color: actionColor }}>{actionLabel}</span>
            <MiniAvatar src={target.image || undefined} fallback={target.name.slice(0, 1)} size={14} />
            {target.addr ? (
              <button
                onClick={(e) => { e.stopPropagation(); onSelectAgent(target!.addr!); }}
                className="text-[10px] text-[#888] hover:text-white hover:underline cursor-pointer transition-colors"
              >
                {target.name}
              </button>
            ) : (
              <span className="text-[10px] text-[#888]">{target.name}</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] uppercase font-bold" style={{ color: actionColor }}>{actionLabel}</span>
            <span className="text-[10px] text-[#555]">own token</span>
          </div>
        )}

        {/* Memo body */}
        <div className="text-[13px] text-[#d1d1d1] leading-relaxed mt-1.5">
          {swap.memo}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 mt-2 text-[10px] text-[#555]">
          <a
            href={`https://basescan.org/tx/${swap.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#38bdf8] transition-colors"
          >
            view tx ↗
          </a>
          <span style={{ color: actionColor, opacity: 0.6 }}>
            {formatEthUsd(swap.amountETH, ethUsdPrice)}
          </span>
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
        <div className="w-full h-full flex items-center justify-center text-[7px] text-[#444]">{fallback ?? '?'}</div>
      )}
    </div>
  );
}
