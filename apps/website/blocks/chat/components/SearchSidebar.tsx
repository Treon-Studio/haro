'use client';
import React, { useState } from 'react';
import { MinimalisticMagniferOutline } from 'solar-icon-set';

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
}

const MOCK_RESULTS: SearchResult[] = [
  { id: '1', title: 'Code review session', snippet: 'Here is my review of the authentication module...' },
  { id: '2', title: 'Tenang architecture', snippet: 'The system uses Astro 5 with React islands...' },
  { id: '3', title: 'Deployment setup', snippet: 'Configure wrangler.jsonc with the correct KV namespace...' },
];

function SearchResultItem({ result }: { result: SearchResult }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: '#ececec', marginBottom: 3 }}>{result.title}</div>
      <div style={{ fontSize: 11, color: '#8e8ea0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.snippet}</div>
    </div>
  );
}

export default function SearchSidebar() {
  const [query, setQuery] = useState('');
  const results = query.trim().length > 0
    ? MOCK_RESULTS.filter(r =>
        r.title.toLowerCase().includes(query.toLowerCase()) ||
        r.snippet.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ padding: '12px 14px 8px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ececec' }}>Search</span>
      </div>
      <div style={{ padding: '0 14px 8px' }}>
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search messages..."
          style={{
            width: '100%', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7,
            padding: '6px 10px', color: '#ececec', fontSize: 12,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {query.trim().length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#5a5a6b' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><MinimalisticMagniferOutline size={32} /></div>
            <div style={{ fontSize: 12 }}>Type to search conversations</div>
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#5a5a6b' }}>
            <div style={{ fontSize: 12 }}>No results for "{query}"</div>
          </div>
        ) : results.map(r => (
          <SearchResultItem key={r.id} result={r} />
        ))}
      </div>
    </div>
  );
}
