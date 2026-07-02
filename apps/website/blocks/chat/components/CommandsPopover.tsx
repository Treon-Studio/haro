'use client';
import React, { useMemo } from 'react';

const PROMPT_LIBRARY = [
  { id: '1', title: 'Summarize', content: 'Please summarize the following text concisely:\n\n' },
  { id: '2', title: 'Translate to English', content: 'Translate the following text to English:\n\n' },
  { id: '3', title: 'Fix grammar', content: 'Please fix the grammar and improve the clarity of:\n\n' },
  { id: '4', title: 'Explain like I am 5', content: 'Explain this concept in simple terms a 5-year-old could understand:\n\n' },
  { id: '5', title: 'Code review', content: 'Please review the following code and suggest improvements:\n\n' },
  { id: '6', title: 'Write unit tests', content: 'Write comprehensive unit tests for the following code:\n\n' },
];

interface CommandsPopoverProps {
  query: string;
  onSelect: (content: string) => void;
  onClose: () => void;
}

export default function CommandsPopover({ query, onSelect, onClose }: CommandsPopoverProps) {
  const filtered = useMemo(
    () => PROMPT_LIBRARY.filter((p) => p.title.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  if (filtered.length === 0) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
      <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6, zIndex: 99, background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 4, boxShadow: '0 -8px 24px rgba(0,0,0,0.5)', maxHeight: 260, overflowY: 'auto' }}>
        <div style={{ padding: '4px 10px 2px', fontSize: 11, color: '#5a5a6b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prompts</div>
        {filtered.map((p) => (
          <button key={p.id} onClick={() => onSelect(p.content)}
            style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: '#ececec', cursor: 'pointer', fontSize: 13 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >/{p.title}</button>
        ))}
      </div>
    </>
  );
}
