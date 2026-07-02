'use client';
import React, { useState, useMemo } from 'react';
import { MinimalisticMagniferOutline, PenOutline, ChartOutline, GlobalOutline, ClipboardOutline, LightbulbOutline, CPUOutline } from 'solar-icon-set';

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: string;
}

const MOCK_AGENTS: Agent[] = [
  { id: '1', name: 'Code Reviewer', description: 'Reviews your code and suggests improvements', icon: MinimalisticMagniferOutline, category: 'Engineering' },
  { id: '2', name: 'Essay Writer', description: 'Helps write and refine essays and articles', icon: PenOutline, category: 'Writing' },
  { id: '3', name: 'Data Analyst', description: 'Analyzes data and produces insights', icon: ChartOutline, category: 'Analytics' },
  { id: '4', name: 'Translator', description: 'Translates text between languages', icon: GlobalOutline, category: 'Language' },
  { id: '5', name: 'Summarizer', description: 'Condenses long content into key points', icon: ClipboardOutline, category: 'Productivity' },
  { id: '6', name: 'Brainstormer', description: 'Generates creative ideas and solutions', icon: LightbulbOutline, category: 'Creative' },
];

function AgentCard({ agent }: { agent: Agent }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flexShrink: 0, padding: 2, color: '#ececec' }}>
          <agent.icon size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#ececec', marginBottom: 2 }}>{agent.name}</div>
          <div style={{
            fontSize: 11, color: '#8e8ea0', lineHeight: 1.5,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{agent.description}</div>
          <div style={{ fontSize: 10, color: '#5a5a6b', marginTop: 4 }}>{agent.category}</div>
        </div>
      </div>
    </div>
  );
}

export default function AgentsSidebar() {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(
    () => MOCK_AGENTS.filter(a =>
      a.name.toLowerCase().includes(filter.toLowerCase()) ||
      a.description.toLowerCase().includes(filter.toLowerCase())
    ),
    [filter],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ padding: '12px 14px 8px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ececec' }}>Agents</span>
      </div>
      <div style={{ padding: '0 14px 8px' }}>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search agents..."
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
          ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#5a5a6b' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><CPUOutline size={32} /></div>
              <div style={{ fontSize: 12 }}>No agents found</div>
            </div>
          )
          : filtered.map(a => <AgentCard key={a.id} agent={a} />)
        }
      </div>
    </div>
  );
}
