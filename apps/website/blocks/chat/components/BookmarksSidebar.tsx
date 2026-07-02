'use client';
import React, { useState, useMemo } from 'react';
import { useBookmarks } from '../hooks/useBookmarks';
import type { Bookmark } from '../hooks/useBookmarks';

function BCard({ bm, onDelete }: { bm: Bookmark; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        cursor: 'pointer', transition: 'background 0.15s',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: bm.color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12, color: '#ececec', fontWeight: 500 }}>{bm.tag}</span>
      <span style={{ fontSize: 11, color: '#5a5a6b', marginRight: 4 }}>{bm.count}</span>
      {hovered && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: '#f87171',
          fontSize: 11, padding: '2px 6px', borderRadius: 4,
        }}>✕</button>
      )}
    </div>
  );
}

export default function BookmarksSidebar() {
  const { bookmarks, deleteBookmark } = useBookmarks();
  const [filter, setFilter] = useState('');

  const filtered = useMemo(
    () => bookmarks.filter(b => b.tag.toLowerCase().includes(filter.toLowerCase())),
    [bookmarks, filter],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ padding: '12px 14px 8px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ececec' }}>Bookmarks</span>
      </div>
      <div style={{ padding: '0 14px 8px' }}>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter bookmarks..."
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
          ? <div style={{ textAlign: 'center', padding: '40px 16px', color: '#5a5a6b', fontSize: 12 }}>No bookmarks found</div>
          : filtered.map(b => <BCard key={b.id} bm={b} onDelete={() => deleteBookmark(b.id)} />)
        }
      </div>
    </div>
  );
}
