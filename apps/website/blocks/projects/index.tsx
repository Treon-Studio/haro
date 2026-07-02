'use client';
import React, { useState } from 'react';

export default function ProjectsView() {
    const [search, setSearch] = useState('');

    const MOCK_PROJECTS = [
        { id: '1', name: 'Website Redesign', desc: 'Migration to Astro and React', chats: 12, date: 'Oct 24, 2023' },
        { id: '2', name: 'Marketing Campaign Q4', desc: 'Copywriting and ad visuals generation', chats: 8, date: 'Oct 20, 2023' },
        { id: '3', name: 'Personal Finance Script', desc: 'Python script for parsing bank statements', chats: 3, date: 'Sep 15, 2023' },
    ];

    const filtered = MOCK_PROJECTS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div style={{ height: '100vh', width: '100%', background: '#171717', color: '#ececec', fontFamily: "'Inter', sans-serif", overflowY: 'auto' }}>
            <div style={{ maxWidth: 896, margin: '0 auto', padding: '48px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <h1 style={{ fontSize: 32, fontWeight: 700 }}>Projects</h1>
                    <button style={{
                        padding: '8px 16px', background: '#ececec', color: '#171717',
                        border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer'
                    }}>
                        + New Project
                    </button>
                </div>

                <div style={{ marginBottom: 32 }}>
                    <input 
                        type="text" 
                        placeholder="Search projects..." 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '12px 16px', borderRadius: 8,
                            background: '#212121', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#ececec', fontSize: 15, outline: 'none',
                        }}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {filtered.map(proj => (
                        <div key={proj.id} style={{
                            background: '#212121', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'border-color 0.2s',
                            display: 'flex', flexDirection: 'column'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                        >
                            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                📁 {proj.name}
                            </div>
                            <div style={{ fontSize: 14, color: '#8e8ea0', lineHeight: 1.5, marginBottom: 16, flex: 1 }}>
                                {proj.desc}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8e8ea0', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <span>{proj.chats} chats</span>
                                <span>{proj.date}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
