'use client';
import React, { useState, useMemo } from 'react';
import { useMemories } from '../hooks/useMemories';
import type { Memory } from '../hooks/useMemories';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function UsageBadge({ total, limit }: { total: number; limit: number }) {
  const pct = Math.min(100, Math.round((total / limit) * 100));
  const color = pct >= 90 ? '#f87171' : pct >= 75 ? '#fbbf24' : '#34d399';
  return (
    <div style={{ padding: '0 14px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: '#8e8ea0' }}>
        <span>Token usage</span>
        <span style={{ color }}>{total} / {limit}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function MemCard({ mem, onDelete }: { mem: Memory; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent', transition: 'background 0.15s',
        position: 'relative',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: '#ececec', marginBottom: 3 }}>{mem.key}</div>
      <div style={{ fontSize: 11, color: '#a0a0b0', lineHeight: 1.5, marginBottom: 4 }}>{mem.value}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#5a5a6b' }}>{mem.tokens} tokens · {formatDate(mem.updatedAt)}</span>
        {hovered && (
          <button onClick={onDelete} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#f87171',
            fontSize: 11, padding: '2px 6px', borderRadius: 4,
          }}>Delete</button>
        )}
      </div>
    </div>
  );
}

export default function MemoriesSidebar() {
  const { memories, deleteMemory, totalTokens, tokenLimit } = useMemories();
  const [filter, setFilter] = useState('');
  const [useMemoryEnabled, setUseMemoryEnabled] = useState(true);

  const filtered = useMemo(
    () => memories.filter(m => (m.key + ' ' + m.value).toLowerCase().includes(filter.toLowerCase())),
    [memories, filter],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 8px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ececec' }}>Memories</span>
        <button
          onClick={() => setUseMemoryEnabled(p => !p)}
          style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 5, border: 'none', cursor: 'pointer',
            background: useMemoryEnabled ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)',
            color: useMemoryEnabled ? '#34d399' : '#8e8ea0',
          }}
        >
          {useMemoryEnabled ? 'On' : 'Off'}
        </button>
      </div>
      <UsageBadge total={totalTokens} limit={tokenLimit} />
      <div style={{ padding: '0 14px 8px' }}>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter memories..."
          style={{
            width: '100%', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7,
            padding: '6px 10px', color: '#ececec', fontSize: 12,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: '40px 16px', color: '#5a5a6b', fontSize: 12 }}>No memories found</div>
          : filtered.map(m => <MemCard key={m.id} mem={m} onDelete={() => deleteMemory(m.id)} />)
        }
      </div>
    </div>
  );
}
