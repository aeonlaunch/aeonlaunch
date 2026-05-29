import { useState } from 'react';
import HoldingsGraph from './HoldingsGraph';
import NetworkStatsBar from './NetworkStatsBar';
import SidePanel from './SidePanel';
import SwapTicker from './SwapTicker';
import { useNetworkGame } from '../hooks/useNetworkGame';
import { useEthPrice } from '../hooks/useEthPrice';
import { useNetworkStore } from '../stores/networkStore';
import { truncateAddress, formatMcap, formatVol, formatChange } from '../lib/formatters';
import type { NetworkAgent as Agent } from '@aeonlaunch/shared';

/** Graph-first network view: always renders UI, agents populate progressively */
export default function NetworkArena() {
  // Fetch ETH/USD price — populates tokenStore for all child components
  useEthPrice();
  const setMobilePanelOpen = useNetworkStore((s) => s.setMobilePanelOpen);
  const setSelectedAgent = useNetworkStore((s) => s.setSelectedAgent);
  const { loadingState, loadProgress, error, agents, manualRefresh, canRefresh, refreshCooldown } = useNetworkGame();

  const [viewMode, setViewMode] = useState<'graph' | 'grid'>('graph');

  const isLoading = loadingState === 'loading';
  const pct = loadProgress.total > 0 ? (loadProgress.current / loadProgress.total) * 100 : 0;
  const isComplete = loadProgress.phase === 'complete';

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#040202]">
      {/* Loading state — game-like boot sequence */}
      {isLoading && (
        <div
          className="shrink-0 relative overflow-hidden transition-opacity duration-700"
          style={{ opacity: isComplete ? 0 : 1 }}
        >
          {/* Progress track with glow */}
          <div className="h-[2px] bg-[#0a0303] relative">
            <div
              className="h-full transition-all duration-300 ease-out"
              style={{
                width: `${Math.max(pct, 15)}%`,
                background: 'linear-gradient(90deg, rgba(255,68,68,0.6), rgba(52,211,153,0.8))',
                boxShadow: '0 0 12px rgba(52,211,153,0.4), 0 0 4px rgba(255,68,68,0.3)',
              }}
            />
            {/* Scanning sweep indicator */}
            <div
              className="absolute top-0 h-full w-[60px]"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(52,211,153,0.3), transparent)',
                animation: 'sweep 2s ease-in-out infinite',
              }}
            />
          </div>
          {/* Phase message with scan aesthetic */}
          <div className="px-3 py-2 flex items-center gap-3 font-mono text-[10px] bg-[#060101] border-b border-[#1e0606]">
            <span
              className="w-[4px] h-[4px] rounded-full bg-[#ff4444]"
              style={{ boxShadow: '0 0 6px rgba(255,68,68,0.5)', animation: 'status-pulse 1.5s ease-in-out infinite' }}
            />
            <span className="text-crt-dim opacity-50 uppercase tracking-[0.15em]">
              {loadProgress.message || 'scanning network...'}
            </span>
            <span className="text-crt-dim opacity-20 ml-auto tracking-widest text-[9px]">
              base
            </span>
          </div>
        </div>
      )}

      {/* Inline error banner with retry */}
      {loadingState === 'error' && (
        <div className="shrink-0 px-3 py-2 flex items-center gap-3 font-mono text-[11px] bg-[#0a0202] border-b border-[#1e0606]">
          <span
            className="w-[4px] h-[4px] rounded-full bg-[#ff4444]"
            style={{ boxShadow: '0 0 6px rgba(255,68,68,0.5)' }}
          />
          <span className="text-crt-accent-bright">signal lost: {error}</span>
          <button
            onClick={manualRefresh}
            className="hud-cmd-btn text-[10px] px-2.5 py-1"
            style={{ boxShadow: '0 0 6px rgba(52,211,153,0.1)' }}
          >
            reconnect
          </button>
        </div>
      )}

      {/* Resource bar */}
      <NetworkStatsBar
        onRefresh={manualRefresh}
        canRefresh={canRefresh}
        refreshCooldown={refreshCooldown}
      />

      {/* Main content — graph left, feed right */}
      <div className="flex-1 min-h-0 flex relative">
        {/* Viewport (toggles between Tactical Graph and Token Cards Grid) */}
        <div className="flex-1 min-h-0 relative hud-viewport hud-scanlines flex flex-col">
          {/* View mode toggle button group */}
          <div className="absolute top-4 left-4 z-20 flex gap-1 bg-[#0a0303e0] border border-[#1e0606] px-1 py-1 rounded shadow-lg backdrop-blur-md">
            <button
              onClick={() => setViewMode('graph')}
              className={`font-mono text-[9px] uppercase tracking-wider px-2.5 py-1 rounded transition-all cursor-pointer border ${
                viewMode === 'graph'
                  ? 'border-[#ff444460] text-crt-accent-glow bg-[#ff444410]'
                  : 'border-transparent text-crt-dim opacity-50 hover:opacity-85'
              }`}
              style={viewMode === 'graph' ? { textShadow: '0 0 6px rgba(255,68,68,0.3)' } : undefined}
            >
              Tactical Graph
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`font-mono text-[9px] uppercase tracking-wider px-2.5 py-1 rounded transition-all cursor-pointer border ${
                viewMode === 'grid'
                  ? 'border-[#ff444460] text-crt-accent-glow bg-[#ff444410]'
                  : 'border-transparent text-crt-dim opacity-50 hover:opacity-85'
              }`}
              style={viewMode === 'grid' ? { textShadow: '0 0 6px rgba(255,68,68,0.3)' } : undefined}
            >
              Token Cards
            </button>
          </div>

          {viewMode === 'graph' ? (
            <div className="flex-1 min-h-0 relative">
              <HoldingsGraph />
              <div className="hud-scanline-overlay pointer-events-none" />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-[#040202] relative pt-16 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map((agent, i) => (
                  <AgentTokenCard
                    key={agent.tokenAddress}
                    agent={agent}
                    index={i}
                    setSelectedAgent={setSelectedAgent}
                  />
                ))}
              </div>
              <div className="hud-scanline-overlay pointer-events-none" />
            </div>
          )}
        </div>

        {/* Right sidebar — swaps between feed and agent detail */}
        <SidePanel />
      </div>

      {/* Mobile: floating toggle for feed/detail */}
      <button
        onClick={() => setMobilePanelOpen(true)}
        className="md:hidden fixed bottom-16 right-4 z-30 w-10 h-10 rounded-full bg-[#1a0808] border border-[#2a1212] flex items-center justify-center text-crt-dim"
      >
        ☰
      </button>

      {/* Event log — bottom console bar */}
      <SwapTicker />
    </div>
  );
}

interface AgentTokenCardProps {
  agent: Agent;
  index: number;
  setSelectedAgent: (addr: string | null) => void;
}

function AgentTokenCard({ agent, index, setSelectedAgent }: AgentTokenCardProps) {
  const ethUsdPrice = useEthPrice();
  const ch = formatChange(agent.priceChange24h);
  const color =
    agent.powerScore.total >= 75 ? '#34d399' :
    agent.powerScore.total >= 50 ? '#a3e635' :
    agent.powerScore.total >= 25 ? '#fb923c' :
    '#ef4444';

  const glow = agent.powerScore.total >= 75 ? `0 0 8px ${color}40` : 'none';

  return (
    <div
      onClick={() => setSelectedAgent(agent.tokenAddress)}
      className="border border-[#1e0606] bg-[#080202] p-5 flex flex-col text-left gap-3.5 transition-all duration-300 relative overflow-hidden rounded group hover:border-[#ff444440] hover:bg-[#0c0303] cursor-pointer"
      style={{
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(255, 68, 68, 0.02)',
      }}
    >
      {/* Glow highlight on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% -20%, rgba(255,68,68,0.08), transparent 70%)' }} />
      <div className="absolute left-0 right-0 top-0 h-[2px] bg-[#ff4444] opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ boxShadow: '0 0 10px #ff4444' }} />

      {/* Header: rank badge + icon + basic details */}
      <div className="flex items-center gap-3.5">
        {/* Agent image */}
        <div className="relative shrink-0 w-16 h-16 border border-[#1e0606] overflow-hidden group-hover:border-[#ff444440] transition-colors">
          <img
            src={agent.image || '/logo-256.png'}
            alt={agent.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ imageRendering: 'pixelated' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo-256.png'; }}
          />
          {/* Retro scanline overlay over agent image */}
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%]" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono tracking-widest text-crt-dim opacity-30">AGENT #{index + 1}</span>
            <span className="text-[10px] font-mono px-1.5 py-px border border-[#ff444440] text-crt-accent-glow rounded bg-[#ff444405]" style={{ textShadow: '0 0 4px rgba(255,68,68,0.2)' }}>
              {agent.symbol}
            </span>
          </div>
          <span className="text-[17px] font-bold text-crt-text truncate group-hover:text-crt-accent-glow transition-colors">{agent.name}</span>
          <span className="text-[10px] text-crt-dim opacity-40 font-mono truncate">{truncateAddress(agent.tokenAddress)}</span>
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <div className="text-[11px] text-crt-dim opacity-45 leading-relaxed font-mono line-clamp-2 h-[34px]">
          {agent.description}
        </div>
      )}

      {/* Power Score bar */}
      <div className="pt-2.5 border-t border-[#1e0606] flex flex-col gap-1">
        <div className="flex items-center justify-between font-mono text-[10px]">
          <span className="text-crt-dim opacity-55 uppercase tracking-wider">power score</span>
          <span className="font-bold text-[14px]" style={{ color, textShadow: glow }}>{agent.powerScore.total}</span>
        </div>
        <div className="w-full h-2.5 bg-[#0a0303] border border-[#1e0606] overflow-hidden rounded-sm">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${agent.powerScore.total}%`,
              backgroundColor: color,
              boxShadow: glow,
              backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 6px, rgba(0,0,0,0.4) 6px, rgba(0,0,0,0.4) 7px)',
            }}
          />
        </div>
      </div>

      {/* Mcap and Volume grid */}
      <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-[#1e0606] font-mono">
        <div className="flex flex-col">
          <span className="text-[9px] text-crt-dim opacity-40 uppercase tracking-widest">market cap</span>
          <span className="text-[16px] text-crt-accent-glow font-bold mt-0.5" style={{ textShadow: '0 0 10px rgba(255,68,68,0.3)' }}>
            {agent.marketCapETH > 0 ? formatMcap(agent.marketCapETH, ethUsdPrice) : '—'}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-crt-dim opacity-40 uppercase tracking-widest">24h change</span>
          <span className={`text-[15px] font-bold mt-0.5 ${ch.cls === 'positive' ? 'text-crt-green' : ch.cls === 'negative' ? 'text-[#ff4444]' : 'text-crt-dim opacity-50'}`} style={ch.cls !== 'neutral' ? { textShadow: ch.cls === 'positive' ? '0 0 8px rgba(52,211,153,0.3)' : '0 0 8px rgba(255,68,68,0.3)' } : undefined}>
            {agent.priceChange24h !== 0 ? `${agent.priceChange24h > 0 ? '+' : ''}${agent.priceChange24h.toFixed(1)}%` : '—'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 font-mono border-t border-[#0e0404]">
        <div className="flex flex-col">
          <span className="text-[9px] text-crt-dim opacity-40 uppercase tracking-widest">holders</span>
          <span className="text-[13px] text-crt-text opacity-85 mt-0.5">{agent.holders > 0 ? agent.holders : '—'}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-crt-dim opacity-40 uppercase tracking-widest">volume 24h</span>
          <span className="text-[13px] text-crt-text opacity-85 mt-0.5">{agent.volume24hETH > 0 ? formatVol(agent.volume24hETH, ethUsdPrice) : '—'}</span>
        </div>
      </div>

      {/* View Details/Flaunch button */}
      <div className="mt-1 flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedAgent(agent.tokenAddress);
          }}
          className="flex-1 font-mono text-[9px] uppercase tracking-wider py-1.5 border border-[#1e0606] text-crt-dim bg-transparent hover:border-[#ff444460] hover:text-crt-accent-glow hover:bg-[#ff444405] transition-all cursor-pointer text-center rounded-sm"
        >
          view details
        </button>
        <a
          href={agent.flaunchUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 font-mono text-[9px] uppercase tracking-wider py-1.5 border border-[#1e0606] text-crt-green bg-transparent hover:border-[#34d39960] hover:text-[#6ee7b7] hover:bg-[#34d39905] transition-all cursor-pointer text-center no-underline rounded-sm"
          style={{ textShadow: '0 0 6px rgba(52,211,153,0.1)' }}
        >
          trade flaunch
        </a>
      </div>
    </div>
  );
}
