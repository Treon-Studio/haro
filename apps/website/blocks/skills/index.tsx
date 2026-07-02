'use client';
import React, { useState } from 'react';

export default function SkillsView() {
    const [search, setSearch] = useState('');

    const MOCK_SKILLS = [
        { id: '1', name: 'Web Browsing', status: 'Active', desc: 'Allows the AI to search the internet for real-time information.', icon: '🌐' },
        { id: '2', name: 'Code Execution', status: 'Active', desc: 'Run Python code in a sandboxed environment to solve math or data problems.', icon: '💻' },
        { id: '3', name: 'Image Generation', status: 'Inactive', desc: 'Generate images using DALL-E 3 models based on text descriptions.', icon: '🎨' },
    ];

    const filtered = MOCK_SKILLS.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div style={{ height: '100vh', width: '100%', background: '#171717', color: '#ececec', fontFamily: "'Inter', sans-serif", overflowY: 'auto' }}>
            <div style={{ maxWidth: 896, margin: '0 auto', padding: '48px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <h1 style={{ fontSize: 32, fontWeight: 700 }}>AI Skills</h1>
                    <button style={{
                        padding: '8px 16px', background: '#ececec', color: '#171717',
                        border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer'
                    }}>
                        + Add Custom Skill
                    </button>
                </div>

                <div style={{ marginBottom: 32 }}>
                    <input 
                        type="text" 
                        placeholder="Search skills..." 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '12px 16px', borderRadius: 8,
                            background: '#212121', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#ececec', fontSize: 15, outline: 'none',
                        }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {filtered.map(skill => (
                        <div key={skill.id} style={{
                            background: '#212121', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 20
                        }}>
                            <div style={{ fontSize: 32, background: 'rgba(255,255,255,0.05)', width: 64, height: 64, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {skill.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{skill.name}</h3>
                                    <span style={{ 
                                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, textTransform: 'uppercase',
                                        background: skill.status === 'Active' ? 'rgba(16,163,127,0.1)' : 'rgba(255,255,255,0.1)',
                                        color: skill.status === 'Active' ? '#10a37f' : '#8e8ea0'
                                    }}>
                                        {skill.status}
                                    </span>
                                </div>
                                <div style={{ fontSize: 14, color: '#8e8ea0', lineHeight: 1.5 }}>
                                    {skill.desc}
                                </div>
                            </div>
                            <div>
                                <button style={{
                                    padding: '8px 16px', background: 'transparent', color: '#ececec',
                                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    Configure
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
