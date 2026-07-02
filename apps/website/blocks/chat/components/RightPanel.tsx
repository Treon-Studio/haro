'use client';
import React, { useState } from 'react';
import { Toggle } from '@treonstudio/bungas-core/ui/toggle';

type PanelTab = 'prompts' | 'plugins' | 'files' | 'agents';

const PROMPTS = [
    { title: 'Professional Email', desc: 'Write a professional email for any situation', category: 'Writing' },
    { title: 'Code Reviewer', desc: 'Review code for bugs, style, and best practices', category: 'Code' },
    { title: "Explain Like I'm 5", desc: 'Simplify complex topics into simple explanations', category: 'Learning' },
    { title: 'SQL Query Builder', desc: 'Build complex SQL queries from natural language', category: 'Code' },
    { title: 'Meeting Summary', desc: 'Summarize meeting notes and extract action items', category: 'Productivity' },
    { title: 'Story Writer', desc: 'Create engaging short stories from prompts', category: 'Creative' },
    { title: 'Resume Bullet Points', desc: 'Turn job duties into achievement statements', category: 'Writing' },
    { title: 'Debug Assistant', desc: 'Explain errors and suggest fixes step-by-step', category: 'Code' },
];

const PLUGINS = [
    { name: 'DALL-E 3', desc: 'Generate images from text', enabled: true, emoji: '🎨' },
    { name: 'Web Search', desc: 'Search the internet in real-time', enabled: true, emoji: '🔍' },
    { name: 'Wolfram Alpha', desc: 'Computational knowledge engine', enabled: false, emoji: '🧮' },
    { name: 'Code Sandbox', desc: 'Execute code in a safe environment', enabled: true, emoji: '💻' },
    { name: 'Weather', desc: 'Get real-time weather data', enabled: false, emoji: '🌤️' },
    { name: 'Calculator', desc: 'Advanced mathematical operations', enabled: false, emoji: '🔢' },
];

const FILES = [
    { name: 'project-spec.pdf', size: '245 KB', type: 'pdf' },
    { name: 'data-export.csv', size: '1.2 MB', type: 'csv' },
    { name: 'screenshot.png', size: '890 KB', type: 'img' },
    { name: 'codebase.zip', size: '4.1 MB', type: 'zip' },
];

const AGENTS = [
    { name: 'Research Assistant', desc: 'Deep research and fact-checking', color: '#10a37f' },
    { name: 'Code Mentor', desc: 'Help debug and explain code', color: '#7c3aed' },
    { name: 'Writing Coach', desc: 'Improve your writing style', color: '#ea580c' },
    { name: 'Data Analyst', desc: 'Analyze and visualize data', color: '#2563eb' },
];



function PromptItem({ title, desc, category }: { title: string; desc: string; category: string }) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                padding: '10px', borderRadius: 8, marginBottom: 2,
                background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                display: 'flex', alignItems: 'flex-start', gap: 8,
            }}
        >
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#ececec' }}>{title}</div>
                <div style={{ fontSize: 11, color: '#8e8ea0', marginTop: 2, lineHeight: '1.4' }}>{desc}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <span style={{
                    fontSize: 10, color: '#5a5a6b', padding: '2px 6px',
                    borderRadius: 4, background: 'rgba(255,255,255,0.05)',
                }}>{category}</span>
                {hovered && (
                    <button style={{
                        padding: '3px 8px', borderRadius: 5, border: 'none',
                        background: '#10a37f', color: 'white', fontSize: 11,
                        cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                    }}>Use</button>
                )}
            </div>
        </div>
    );
}

export default function RightPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [tab, setTab] = useState<PanelTab>('prompts');
    const [search, setSearch] = useState('');
    const [plugins, setPlugins] = useState(PLUGINS.map((p) => ({ ...p })));

    const togglePlugin = (i: number) => {
        setPlugins((prev) => prev.map((p, idx) => (idx === i ? { ...p, enabled: !p.enabled } : p)));
    };

    const tabs: { id: PanelTab; label: string }[] = [
        { id: 'prompts', label: 'Prompts' },
        { id: 'plugins', label: 'Plugins' },
        { id: 'files', label: 'Files' },
        { id: 'agents', label: 'Agents' },
    ];

    return (
        <div style={{
            width: open ? 300 : 0,
            minWidth: open ? 300 : 0,
            height: '100vh',
            background: '#171717',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)',
            flexShrink: 0,
        }}>
            {/* Fixed inner wrapper so content doesn't squish during animation */}
            <div style={{
                width: 300, display: 'flex', flexDirection: 'column', height: '100%',
                opacity: open ? 1 : 0, transition: 'opacity 0.15s',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }}>
                {/* ── Header ── */}
                <div style={{
                    height: 52, display: 'flex', alignItems: 'center',
                    padding: '0 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: 8,
                }}>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#ececec', textTransform: 'capitalize' }}>
                        {tabs.find(t => t.id === tab)?.label}
                    </span>
                    <button
                        onClick={onClose}
                        style={{
                            width: 28, height: 28, borderRadius: 7, border: 'none',
                            background: 'transparent', color: '#8e8ea0', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#ececec'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
                    >×</button>
                </div>

                {/* ── Tab bar ── */}
                <div style={{ display: 'flex', padding: '0 4px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            style={{
                                flex: 1, padding: '10px 6px 8px',
                                border: 'none',
                                borderBottom: `2px solid ${tab === t.id ? '#10a37f' : 'transparent'}`,
                                background: 'transparent',
                                color: tab === t.id ? '#ececec' : '#8e8ea0',
                                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                                transition: 'color 0.1s, border-color 0.1s',
                                fontFamily: "'Inter', sans-serif",
                            }}
                            onMouseEnter={(e) => { if (tab !== t.id) (e.currentTarget as HTMLElement).style.color = '#c5c5d2'; }}
                            onMouseLeave={(e) => { if (tab !== t.id) (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
                        >{t.label}</button>
                    ))}
                </div>

                {/* ── Tab Content ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>

                    {/* PROMPTS */}
                    {tab === 'prompts' && (
                        <>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search prompts…"
                                style={{
                                    width: '100%', padding: '7px 10px', borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.1)', background: '#2f2f2f',
                                    color: '#ececec', fontSize: 12, outline: 'none', marginBottom: 8,
                                    boxSizing: 'border-box', fontFamily: "'Inter', sans-serif",
                                }}
                            />
                            {PROMPTS
                                .filter((p) => !search || p.title.toLowerCase().includes(search.toLowerCase()))
                                .map((p, i) => <PromptItem key={i} {...p} />)
                            }
                        </>
                    )}

                    {/* PLUGINS */}
                    {tab === 'plugins' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {plugins.map((p, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 12px', borderRadius: 10,
                                    background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.05)',
                                }}>
                                    <div style={{
                                        width: 34, height: 34, borderRadius: 8, background: '#3a3a3a',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 18, flexShrink: 0,
                                    }}>{p.emoji}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: '#ececec' }}>{p.name}</div>
                                        <div style={{ fontSize: 11, color: '#8e8ea0' }}>{p.desc}</div>
                                    </div>
                                    <Toggle pressed={p.enabled} onPressedChange={() => togglePlugin(i)} size="sm" variant="outline">
                                        {p.enabled ? 'On' : 'Off'}
                                    </Toggle>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* FILES */}
                    {tab === 'files' && (
                        <>
                            <button
                                style={{
                                    width: '100%', padding: '20px 12px', borderRadius: 10,
                                    border: '2px dashed rgba(255,255,255,0.12)', background: 'transparent',
                                    color: '#8e8ea0', fontSize: 13, cursor: 'pointer', marginBottom: 12,
                                    fontFamily: "'Inter', sans-serif", transition: 'border-color 0.15s, color 0.15s',
                                    boxSizing: 'border-box',
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,163,127,0.4)'; (e.currentTarget as HTMLElement).style.color = '#10a37f'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
                            >
                                <div style={{ fontSize: 20, marginBottom: 4 }}>📎</div>
                                Upload or drop files here
                            </button>
                            {FILES.map((f, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 7, background: '#2f2f2f',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 10, color: '#8e8ea0', fontWeight: 700, flexShrink: 0,
                                        border: '1px solid rgba(255,255,255,0.06)',
                                    }}>{f.type.toUpperCase()}</div>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{ fontSize: 12, color: '#ececec', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                                        <div style={{ fontSize: 11, color: '#8e8ea0' }}>{f.size}</div>
                                    </div>
                                    <button
                                        style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'transparent', color: '#8e8ea0', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ff6b6b'; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
                                    >×</button>
                                </div>
                            ))}
                        </>
                    )}

                    {/* AGENTS */}
                    {tab === 'agents' && (
                        <>
                            <button style={{
                                width: '100%', padding: '8px 12px', borderRadius: 8,
                                border: '1px solid rgba(16,163,127,0.4)', background: 'rgba(16,163,127,0.08)',
                                color: '#10a37f', fontSize: 13, cursor: 'pointer', marginBottom: 12,
                                fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16,163,127,0.15)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(16,163,127,0.08)')}
                            >+ Create agent</button>
                            {AGENTS.map((a, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 12px', borderRadius: 10, background: '#2f2f2f',
                                    marginBottom: 8, cursor: 'pointer',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    transition: 'border-color 0.12s',
                                }}
                                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)')}
                                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)')}
                                >
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10, background: a.color,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0,
                                    }}>{a.name[0]}</div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: '#ececec' }}>{a.name}</div>
                                        <div style={{ fontSize: 11, color: '#8e8ea0' }}>{a.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
