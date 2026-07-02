'use client';

import React, { useState } from 'react';
import { useSkills } from './useSkills';

function IconPlus() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    );
}

function IconChevronDown({ open }: { open: boolean }) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
    );
}

export default function SkillsSidebar() {
  const { skills } = useSkills();
  const [sectionOpen, setSectionOpen] = useState(true);

  const isCreating = typeof window !== 'undefined' && window.location.pathname.endsWith('/new');
  const pathParts = typeof window !== 'undefined' ? window.location.pathname.split('/') : [];
  const activeSkillId = (!isCreating && pathParts.length > 2) ? pathParts[2] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px 12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#ececec', margin: 0 }}>Skills</h2>
        <button 
          onClick={() => window.location.href = '/skills/new'}
          style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: '#8e8ea0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = '#ececec'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
        >
          <IconPlus />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', cursor: 'pointer' }}
          onClick={() => setSectionOpen(!sectionOpen)}
        >
          <span style={{ color: '#ececec', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
             My Skills <IconChevronDown open={sectionOpen} />
          </span>
        </div>

        {sectionOpen && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {skills.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#8e8ea0', fontSize: 12, padding: '24px 16px' }}>
                No skills found
              </p>
            ) : (
              skills.map((skill) => {
                const isActive = skill.id === activeSkillId && !isCreating;
                return (
                  <button
                    key={skill.id}
                    onClick={() => window.location.href = `/skills/${skill.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: 8,
                      background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: isActive ? '#ececec' : '#c5c5d2',
                      fontSize: 13, textAlign: 'left', cursor: 'pointer', border: 'none', transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.name}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
