'use client';

import React, { useState } from 'react';
import { usePrompts } from './usePrompts';

export type PromptGroup = {
  id: string;
  name: string;
  category: string;
  snippet: string;
  authorName?: string;
  isPublic?: boolean;
};

function IconListFilter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
    </svg>
  );
}

function IconCreatePrompt() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function IconFileText() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  );
}

export function PromptSidebar() {
  const { prompts, isLoading } = usePrompts();
  const [searchTerm, setSearchTerm] = useState('');

  const pathParts = typeof window !== 'undefined' ? window.location.pathname.split('/') : [];
  const activePromptId = pathParts.length > 2 ? pathParts[2] : null;

  const filteredPrompts = prompts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px 12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#ececec', margin: 0 }}>Prompts</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, marginTop: 12 }}>
        {/* Filter Prompts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 12px' }}>
          <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'transparent', color: '#8e8ea0', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
            <IconListFilter />
          </button>
          <div style={{ flex: 1 }}>
            <input
              placeholder="Filter Prompts"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', padding: '0 12px', fontSize: 13, color: '#ececec', outline: 'none' }}
            />
          </div>
          <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'transparent', color: '#8e8ea0', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
            <IconCreatePrompt />
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {isLoading ? (
            <p style={{ textAlign: 'center', color: '#8e8ea0', fontSize: 12, padding: '24px 16px' }}>Loading...</p>
          ) : filteredPrompts.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#8e8ea0', fontSize: 12, padding: '24px 16px' }}>No Prompts Found</p>
          ) : (
            filteredPrompts.map((group) => {
              const isActive = activePromptId === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => window.location.href = `/prompts/${group.id}`}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8,
                    background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: isActive ? '#ececec' : '#c5c5d2',
                    fontSize: 13, textAlign: 'left', cursor: 'pointer', border: 'none', transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div style={{ marginTop: 2, color: '#8e8ea0' }}><IconFileText /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#ececec' }}>{group.name}</div>
                    <div style={{ fontSize: 11, color: '#8e8ea0', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {group.snippet}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
