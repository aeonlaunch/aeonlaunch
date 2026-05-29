import { useMemo, useState } from 'react';
import { useNetworkGame } from '../hooks/useNetworkGame';
import { useNetworkStore } from '../stores/networkStore';
import type { AgentDelta } from '../stores/networkStore';
import type { NetworkAgent as Agent, PowerScore } from '@aeonlaunch/shared';
import { formatMcap, formatVol, truncateAddress, formatChange } from '../lib/formatters';
import { useEthPrice } from '../hooks/useEthPrice';
import AgentDetailPanel from './AgentDetailPanel';

type SortKey = 'power' | 'mcap' | 'vol' | 'holders' | 'name';

export default function AgentGrid() {
  const { agents, loading, error, refreshing, lastRefresh } = useNetworkGame();
  const ethUsdPrice = useEthPrice();
  const sortBy = useNetworkStore((s) => s.sortBy);
  const setSortBy = useNetworkStore((s) => s.setSortBy);
  const agentDeltas = useNetworkStore((s) => s.agentDeltas);
  const selectedAgent = useNetworkStore((s) => s.selectedAgent);
  const setSelectedAgent = useNetworkStore((s) => s.setSelectedAgent);
  const filterType = useNetworkStore((s) => s.filterType);
  const setFilterType = useNetworkStore((s) => s.setFilterType);
  const filterPower = useNetworkStore((s) => s.filterPower);
  const setFilterPower = useNetworkStore((s) => s.setFilterPower);
  const filterActivity = useNetworkStore((s) => s.filterActivity);
  const setFilterActivity = useNetworkStore((s) => s.setFilterActivity);
  const searchQuery = useNetworkStore((s) => s.searchQuery);
  const setSearchQuery = useNetworkStore((s) => s.setSearchQuery);

  const [viewType, setViewType] = useState<'cards' | 'table'>('cards');

  const filtered = useMemo(() => {
    let result = agents;

    // Type filter
    if (filterType !== 'all') {
      result = result.filter((a) =>
        filterType === 'agents' ? a.type === 'agent' : a.type === 'human',
      );
    }

    // Power tier filter
    if (filterPower === '50+') {
      result = result.filter((a) => a.powerScore.total >= 50);
    } else if (filterPower === '75+') {
      result = result.filter((a) => a.powerScore.total >= 75);
    }

    // Activity filter
    if (filterActivity === 'active') {
      result = result.filter((a) => a.recentSwaps >= 5);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (a) => a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q),
      );
    }

    return result;
  }, [agents, filterType, filterPower, filterActivity, searchQuery]);

  if (error) {
    return (
      <div className="font-mono text-[11px] text-crt-accent-bright px-4 py-6">
        error: {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="font-mono text-[11px] text-crt-dim px-4 py-6 animate-pulse">
        scanning network...
      </div>
    );
  }

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'power': return b.powerScore.total - a.powerScore.total;
      case 'vol': return b.volume24hETH - a.volume24hETH;
      case 'mcap': return b.marketCapETH - a.marketCapETH;
      case 'holders': return b.holders - a.holders;
      case 'name': return a.name.localeCompare(b.name);
      default: return 0;
    }
  });

  const totalVol = filtered.reduce((s, a) => s + a.volume24hETH, 0);
  const totalMcap = filtered.reduce((s, a) => s + a.marketCapETH, 0);
  const avgPower = filtered.length > 0
    ? Math.round(filtered.reduce((s, a) => s + a.powerScore.total, 0) / filtered.length)
    : 0;
  const totalHolders = filtered.reduce((s, a) => s + a.holders, 0);

  const isFiltered = filterType !== 'all' || filterPower !== 'all' || filterActivity !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="relative">
      {/* Detail panel overlay */}
      {selectedAgent && <AgentDetailPanel />}

      {/* Refresh indicator */}
      {refreshing && (
        <div className="flex items-center gap-2 mb-2 font-mono text-[9px] text-crt-dim opacity-50">
          <span className="w-[5px] h-[5px] rounded-full bg-crt-green animate-pulse" style={{ boxShadow: '0 0 4px rgba(52,211,153,0.5)' }} />
          refreshing...
        </div>
      )}

      {/* Network stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px mb-4 border border-[#1e0606]">
        <Stat label="agents" value={isFiltered ? `${filtered.length} / ${agents.length}` : `${agents.length}`} />
        <Stat label="avg power" value={String(avgPower)} accent={avgPower > 50} />
        <Stat label="total mcap" value={totalMcap > 0 ? formatMcap(totalMcap, ethUsdPrice) : '—'} />
        <Stat label="24h volume" value={totalVol > 0 ? formatVol(totalVol, ethUsdPrice) : '—'} />
        <Stat label="holders" value={totalHolders > 0 ? String(totalHolders) : '—'} />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-3 font-mono text-[10px]">
        {/* Type chips */}
        <ChipGroup
          options={[
            { value: 'all', label: 'All' },
            { value: 'agents', label: 'Agents' },
            { value: 'humans', label: 'Humans' },
          ]}
          selected={filterType}
          onChange={(v) => setFilterType(v as 'all' | 'agents' | 'humans')}
        />
        <span className="text-[#1e0606]">│</span>
        {/* Power chips */}
        <ChipGroup
          options={[
            { value: 'all', label: 'Any PWR' },
            { value: '50+', label: '50+' },
            { value: '75+', label: '75+' },
          ]}
          selected={filterPower}
          onChange={(v) => setFilterPower(v as 'all' | '50+' | '75+')}
        />
        <span className="text-[#1e0606]">│</span>
        {/* Activity chip */}
        <ChipGroup
          options={[
            { value: 'all', label: 'Any' },
            { value: 'active', label: 'Active' },
          ]}
          selected={filterActivity}
          onChange={(v) => setFilterActivity(v as 'all' | 'active')}
        />
        <span className="text-[#1e0606]">│</span>
        {/* Search input */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="search..."
          className="bg-[#060101] border border-[#1e0606] text-crt-text text-[10px] px-2 py-1 w-[120px] font-mono placeholder:text-[#333] focus:outline-none focus:border-[#ff444440]"
        />
      </div>

      {lastRefresh && (
        <div className="flex justify-end mb-2">
          <span className="font-mono text-crt-dim opacity-35 text-[10px]">
            {new Date(lastRefresh).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Filter notice & View Toggle */}
      <div className="flex items-center justify-between mb-4 font-mono text-[10px]">
        <div className="flex items-center gap-2 text-crt-dim opacity-45">
          <span className="text-[6px] text-[#ff4444] opacity-60">&#x25C6;</span>
          {isFiltered
            ? `showing ${filtered.length} of ${agents.length} players`
            : 'showing agents with 5+ holders and active market cap'}
        </div>
        <div className="flex gap-1 bg-[#0a0303e0] border border-[#1e0606] px-1 py-1 rounded shadow-md">
          <button
            onClick={() => setViewType('cards')}
            className={`px-2 py-0.5 cursor-pointer rounded transition-all text-[8px] uppercase tracking-wider border ${
              viewType === 'cards'
                ? 'border-[#ff444440] text-crt-accent-glow bg-[#ff444405]'
                : 'border-transparent text-crt-dim opacity-50 hover:opacity-85'
            }`}
          >
            Cards Grid
          </button>
          <button
            onClick={() => setViewType('table')}
            className={`px-2 py-0.5 cursor-pointer rounded transition-all text-[8px] uppercase tracking-wider border ${
              viewType === 'table'
                ? 'border-[#ff444440] text-crt-accent-glow bg-[#ff444405]'
                : 'border-transparent text-crt-dim opacity-50 hover:opacity-85'
            }`}
          >
            Compact Table
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="font-mono text-[11px] text-crt-dim py-6">
          <span className="text-crt-dim opacity-50">no active players.</span>
          <span className="text-crt-accent-glow ml-2" style={{ textShadow: '0 0 6px rgba(255,68,68,0.3)' }}>
            npx aeonlaunch launch
          </span>
        </div>
      ) : viewType === 'table' ? (
        <div className="border border-[#1e0606]">
          {/* Header */}
          <div className="agent-row-grid font-mono text-[10px] text-crt-dim uppercase tracking-[0.15em] opacity-60 border-b border-[#1e0606] bg-[#060101]">
            <span className="px-3 py-2.5">#</span>
            <span className="px-3 py-2.5">agent</span>
            <SortHeader label="power" current={sortBy} sortKey="power" onSort={setSortBy} />
            <SortHeader label="mcap" current={sortBy} sortKey="mcap" onSort={setSortBy} />
            <span className="px-3 py-2.5">24h</span>
            <SortHeader label="holders" current={sortBy} sortKey="holders" onSort={setSortBy} />
          </div>

          {/* Rows */}
          {sorted.map((agent, i) => (
            <AgentRow
              key={agent.tokenAddress}
              agent={agent}
              rank={i + 1}
              ethUsdPrice={ethUsdPrice}
              delta={agentDeltas.get(agent.tokenAddress)}
              onSelect={() => setSelectedAgent(agent.tokenAddress)}
              isSelected={selectedAgent === agent.tokenAddress}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sorted.map((agent, i) => (
            <AgentTokenCard
              key={agent.tokenAddress}
              agent={agent}
              index={i}
              ethUsdPrice={ethUsdPrice}
              setSelectedAgent={setSelectedAgent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-[#060101] px-4 py-4 font-mono">
      <div className="text-[11px] text-crt-dim uppercase tracking-[0.2em] opacity-60 mb-1">{label}</div>
      <div
        className={`text-[28px] font-bold ${accent ? 'text-crt-green' : 'text-crt-text'}`}
        style={accent ? { textShadow: '0 0 8px rgba(52,211,153,0.4)' } : { textShadow: '0 0 4px rgba(255,255,255,0.05)' }}
      >
        {value}
      </div>
      {sub && <div className="text-[9px] text-crt-dim opacity-40 mt-0.5">{sub}</div>}
    </div>
  );
}

function SortHeader({
  label, current, sortKey, onSort,
}: {
  label: string; current: SortKey; sortKey: SortKey; onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`px-3 py-2.5 text-left cursor-pointer transition-colors ${active ? 'text-crt-accent-glow opacity-100' : 'hover:text-crt-accent-glow hover:opacity-60'}`}
      style={active ? { textShadow: '0 0 6px rgba(255,68,68,0.3)' } : undefined}
    >
      {label}{active ? ' ↓' : ''}
    </button>
  );
}

function RankDeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const up = delta > 0;
  return (
    <span
      className={`text-[9px] font-mono ml-1 ${up ? 'text-crt-green' : 'text-[#ff4444]'}`}
      style={{ textShadow: up ? '0 0 4px rgba(52,211,153,0.4)' : '0 0 4px rgba(255,68,68,0.3)' }}
    >
      {up ? '↑' : '↓'}{Math.abs(delta)}
    </span>
  );
}

function NewBadge() {
  return (
    <span
      className="text-[8px] font-mono ml-1.5 px-1 py-px border border-[#a78bfa] text-[#a78bfa] uppercase tracking-wider animate-pulse"
      style={{ textShadow: '0 0 4px rgba(167,139,250,0.4)' }}
    >
      new
    </span>
  );
}

function PowerBar({ score }: { score: PowerScore }) {
  const color =
    score.total >= 75 ? '#34d399' :
    score.total >= 50 ? '#a3e635' :
    score.total >= 25 ? '#fb923c' :
    '#ef4444';

  const glow = score.total >= 75 ? `0 0 6px ${color}40` : 'none';

  return (
    <div className="flex items-center gap-2 group relative">
      <div className="w-[80px] h-[12px] bg-[#0a0303] border border-[#1e0606] overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${score.total}%`,
            backgroundColor: color,
            boxShadow: glow,
            backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 6px, rgba(0,0,0,0.4) 6px, rgba(0,0,0,0.4) 7px)',
          }}
        />
      </div>
      <span className="text-[20px] font-bold opacity-90" style={{ color, textShadow: glow }}>
        {score.total}
      </span>
      {/* Tooltip */}
      <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50">
        <div className="bg-[#0a0303] border border-[#1e0606] px-2 py-1.5 font-mono text-[10px] whitespace-nowrap">
          <div className="text-crt-dim opacity-60 mb-1">power breakdown</div>
          <div className="flex gap-3">
            <span>REV <span className="text-crt-text">{score.revenue}</span></span>
            <span>MKT <span className="text-crt-text">{score.market}</span></span>
            <span>NET <span className="text-crt-text">{score.network}</span></span>
            <span>VIT <span className="text-crt-text">{score.vitality}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  options, selected, onChange,
}: {
  options: Array<{ value: T; label: string }>; selected: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => {
        const active = selected === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2 py-0.5 cursor-pointer transition-all border ${
              active
                ? 'border-[#ff444460] text-crt-accent-glow bg-[#ff444410]'
                : 'border-[#1e0606] text-crt-dim opacity-50 hover:opacity-80 hover:border-[#ff444430]'
            }`}
            style={active ? { textShadow: '0 0 6px rgba(255,68,68,0.3)' } : undefined}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function AgentRow({
  agent, rank, ethUsdPrice, delta, onSelect, isSelected,
}: {
  agent: Agent; rank: number; ethUsdPrice: number; delta?: AgentDelta; onSelect: () => void; isSelected: boolean;
}) {
  const pct = agent.priceChange24h;
  const pctColor = pct > 0 ? 'text-crt-green' : pct < 0 ? 'text-[#ff4444]' : 'text-crt-dim opacity-30';
  const pctText = pct !== 0 ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : '—';

  // Determine mcap flash class based on delta
  const mcapFlash = delta && !delta.isNew && Math.abs(delta.mcapDeltaPct) >= 5
    ? delta.mcapDeltaPct > 0 ? 'mcap-flash-green' : 'mcap-flash-red'
    : '';

  return (
    <div
      onClick={onSelect}
      className={`agent-row-grid font-mono text-[13px] border-b border-[#0e0404] transition-all hover:bg-[#0a0303] cursor-pointer group ${isSelected ? 'bg-[#0a0303] border-l-2 border-l-[#ff4444]' : ''}`}
    >
      {/* Rank */}
      <span className="px-3 py-4 flex items-center justify-center">
        {rank <= 3 ? (
          <span className={`rank-badge rank-badge-${rank}`}>{rank}</span>
        ) : (
          <span className="text-crt-dim opacity-50 text-[14px]">{rank}</span>
        )}
        {delta && delta.isNew && <NewBadge />}
        {delta && !delta.isNew && <RankDeltaBadge delta={delta.rankDelta} />}
      </span>

      {/* Agent name + symbol + description */}
      <span className="px-3 py-4 flex items-center gap-3 min-w-0">
        <img
          src={agent.image || '/logo-256.png'}
          alt=""
          className="w-12 h-12 border border-[#1e0606] shrink-0"
          style={{ imageRendering: 'pixelated' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo-256.png'; }}
        />
        <span className="min-w-0">
          <span className="flex items-baseline gap-2 truncate">
            <span className="text-[18px] font-bold text-crt-text group-hover:text-crt-accent-glow transition-colors">{agent.name}</span>
            <span className="text-crt-dim opacity-40 text-[14px]">{agent.symbol}</span>
          </span>
          {agent.description && (
            <span className="block text-[11px] text-crt-dim opacity-30 truncate leading-tight mt-0.5">
              {agent.description.slice(0, 60)}
            </span>
          )}
        </span>
      </span>

      {/* Power Score */}
      <span className="px-3 py-2.5">
        <PowerBar score={agent.powerScore} />
      </span>

      {/* MCap */}
      <span className={`px-3 py-4 text-[18px] text-crt-text opacity-85 whitespace-nowrap ${mcapFlash}`}>
        {agent.marketCapETH > 0 ? formatMcap(agent.marketCapETH, ethUsdPrice) : '—'}
      </span>

      {/* 24h change */}
      <span className={`px-3 py-4 text-[14px] whitespace-nowrap ${pctColor}`}>
        {pctText}
      </span>

      {/* Holders */}
      <span className="px-3 py-4 text-[14px] text-crt-text opacity-75">
        {agent.holders > 0 ? agent.holders : '—'}
        {agent.crossHoldings > 0 && (
          <span className="text-[#a78bfa] text-[10px] ml-0.5" title="Cross-holdings from other agents">
            +{agent.crossHoldings}
          </span>
        )}
      </span>
    </div>
  );
}

interface AgentTokenCardProps {
  agent: Agent;
  index: number;
  ethUsdPrice: number;
  setSelectedAgent: (addr: string | null) => void;
}

function AgentTokenCard({ agent, index, ethUsdPrice, setSelectedAgent }: AgentTokenCardProps) {
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
        {agent.image ? (
          <div className="relative shrink-0 w-16 h-16 border border-[#1e0606] overflow-hidden group-hover:border-[#ff444440] transition-colors">
            <img
              src={agent.image}
              alt={agent.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              style={{ imageRendering: 'pixelated' }}
            />
            {/* Retro scanline overlay over agent image */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%]" />
          </div>
        ) : (
          <div className="w-16 h-16 border border-[#1e0606] bg-[#0a0303] flex items-center justify-center shrink-0 font-mono text-[#1e0606] text-[10px]">
            ···
          </div>
        )}

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
