'use client';
import React, { useState, useMemo } from 'react';

interface FileMeta { id: string; name: string; type: string; size: number; uploadedAt: string; }
const MOCK_FILES: FileMeta[] = [
  { id: '1', name: 'architecture.pdf', type: 'PDF', size: 245000, uploadedAt: 'Jun 18, 2026' },
  { id: '2', name: 'screenshot.png', type: 'Image', size: 82000, uploadedAt: 'Jun 18, 2026' },
  { id: '3', name: 'data-export.csv', type: 'CSV', size: 34000, uploadedAt: 'Jun 17, 2026' },
  { id: '4', name: 'notes.txt', type: 'Text', size: 5000, uploadedAt: 'Jun 16, 2026' },
  { id: '5', name: 'codebase.zip', type: 'ZIP', size: 1200000, uploadedAt: 'Jun 14, 2026' },
];
const TYPE_COLORS: Record<string, string> = { PDF: '#ef4444', Image: '#3b82f6', CSV: '#10a37f', Text: '#8e8ea0', ZIP: '#f59e0b' };
function fmt(b: number) { return b < 1024 ? `${b}B` : b < 1048576 ? `${(b / 1024).toFixed(0)}KB` : `${(b / 1048576).toFixed(1)}MB`; }

function FileRow({ file }: { file: FileMeta }) {
  const [hovered, setHovered] = useState(false);
  const [attached, setAttached] = useState(false);
  const c = TYPE_COLORS[file.type] ?? '#8e8ea0';
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: hovered ? 'rgba(255,255,255,0.02)' : 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: c, background: `${c}22`, padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>{file.type}</span>
      <span style={{ flex: 1, fontSize: 12, color: '#ececec', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
      <span style={{ fontSize: 11, color: '#5a5a6b', flexShrink: 0 }}>{fmt(file.size)}</span>
      {hovered && (
        <button onClick={e => { e.stopPropagation(); setAttached(true); setTimeout(() => setAttached(false), 2000); }}
          style={{ padding: '3px 8px', borderRadius: 5, border: 'none', background: attached ? 'rgba(16,163,127,0.2)' : 'rgba(255,255,255,0.08)', color: attached ? '#10a37f' : '#ececec', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}>
          {attached ? 'Attached!' : 'Attach'}
        </button>
      )}
    </div>
  );
}

export default function FilesSidebar() {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => MOCK_FILES.filter(f => f.name.toLowerCase().includes(filter.toLowerCase())), [filter]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ padding: '12px 14px 8px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ececec' }}>Files</span>
      </div>
      <div style={{ padding: '0 14px 8px' }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter files..."
          style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '6px 10px', color: '#ececec', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: '40px 16px', color: '#5a5a6b' }}><div style={{ fontSize: 32, marginBottom: 8 }}>📎</div><div style={{ fontSize: 12 }}>No files yet</div></div>
          : filtered.map(f => <FileRow key={f.id} file={f} />)
        }
      </div>
    </div>
  );
}
