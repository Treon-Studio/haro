'use client';
import React, { useMemo } from 'react';
import { MODELS } from '../config/providers';

interface MentionPopoverProps {
  query: string;
  onSelect: (label: string) => void;
  onClose: () => void;
}

export default function MentionPopover({ query, onSelect, onClose }: MentionPopoverProps) {
  const filtered = useMemo(
    () => MODELS.filter((m) => m.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  if (filtered.length === 0) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
      <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6, zIndex: 99, background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 4, boxShadow: '0 -8px 24px rgba(0,0,0,0.5)', maxHeight: 220, overflowY: 'auto' }}>
        <div style={{ padding: '4px 10px 2px', fontSize: 11, color: '#5a5a6b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Models</div>
        {filtered.map((model) => (
          <button key={model.id} onClick={() => onSelect(`@${model.label} `)}
            style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: '#ececec', cursor: 'pointer', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 1 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontWeight: 500 }}>@{model.label}</span>
            {model.description && <span style={{ fontSize: 11, color: '#8e8ea0' }}>{model.description}</span>}
          </button>
        ))}
      </div>
    </>
  );
}
