import { useState } from 'react';
import { useNetworkStore } from '../stores/networkStore';
import type { ChangeFeedEntry } from '../stores/networkStore';

const ICON: Record<ChangeFeedEntry['type'], string> = {
  rank: '↑',
  mcap: '◆',
  new: '+',
  drop: '↓',
};

const COLOR: Record<ChangeFeedEntry['type'], string> = {
  rank: 'text-crt-green',
  mcap: 'text-crt-green',
  new: 'text-[#a78bfa]',
  drop: 'text-[#ff4444]',
};

export default function ChangeFeed() {
  const changeFeed = useNetworkStore((s) => s.changeFeed);
  const [collapsed, setCollapsed] = useState(false);

  if (changeFeed.length === 0) return null;

  return (
    <div className="mb-3 border border-[#1e0606] bg-[#060101]">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-[#0a0303] transition-colors"
      >
        <span className="flex items-center gap-2">
          <span
            className="w-[4px] h-[4px] rounded-full bg-crt-green animate-pulse"
            style={{ boxShadow: '0 0 4px rgba(52,211,153,0.5)' }}
          />
          <span className="font-mono text-[11px] text-crt-dim uppercase tracking-[0.15em] opacity-60">
            recent changes
          </span>
          <span className="font-mono text-[11px] text-crt-dim opacity-30">
            ({changeFeed.length})
          </span>
        </span>
        <span className="font-mono text-[11px] text-crt-dim opacity-30">
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {/* Entries */}
      {!collapsed && (
        <div className="px-3 pb-2 space-y-0.5">
          {changeFeed.map((entry) => (
            <div
              key={entry.id}
              className="font-mono text-[13px] flex items-center gap-1.5 opacity-70"
            >
              <span
                className={`${COLOR[entry.type]} text-[11px]`}
                style={{ textShadow: '0 0 4px currentColor' }}
              >
                {ICON[entry.type]}
              </span>
              <span className="text-crt-dim">{entry.text}</span>
              <span className="text-crt-dim opacity-25 ml-auto text-[11px]">
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
