'use client';
import React, { useState } from 'react';

// Simplified Agent Marketplace matching LibreChat's basic visual structure
export default function AgentMarketplace() {
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');

    const categories = [
        { id: 'all', label: 'All' },
        { id: 'promoted', label: 'Top Picks' },
        { id: 'programming', label: 'Programming' },
        { id: 'writing', label: 'Writing' },
        { id: 'productivity', label: 'Productivity' }
    ];

    const MOCK_AGENTS = [
        { id: '1', name: 'Code Expert', desc: 'Expert in React and Node.js', category: 'programming', icon: '💻' },
        { id: '2', name: 'Creative Writer', desc: 'Helps write stories and blogs', category: 'writing', icon: '✍️' },
        { id: '3', name: 'Task Manager', desc: 'Organizes your daily tasks', category: 'productivity', icon: '📋' },
        { id: '4', name: 'SQL Master', desc: 'Generates complex SQL queries', category: 'programming', icon: '🗄️' },
    ];

    const filteredAgents = MOCK_AGENTS.filter(a => 
        (activeCategory === 'all' || activeCategory === 'promoted' || a.category === activeCategory) &&
        a.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ height: '100vh', width: '100%', background: '#171717', color: '#ececec', fontFamily: "'Inter', sans-serif", overflowY: 'auto' }}>
            <div style={{ maxWidth: 896, margin: '0 auto', padding: '48px 24px' }}>
                <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 12 }}>Agent Marketplace</h1>
                    <p style={{ fontSize: 18, color: '#8e8ea0' }}>Discover and install specialized AI agents for your workflow</p>
                </div>

                <div style={{ position: 'sticky', top: 0, background: '#171717', paddingTop: 16, paddingBottom: 16, zIndex: 10 }}>
                    <input 
                        type="text" 
                        placeholder="Search agents..." 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '12px 16px', borderRadius: 8,
                            background: '#212121', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#ececec', fontSize: 15, marginBottom: 24,
                            outline: 'none',
                        }}
                    />

                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                style={{
                                    padding: '8px 16px', borderRadius: 20, border: 'none',
                                    background: activeCategory === cat.id ? '#ececec' : 'rgba(255,255,255,0.05)',
                                    color: activeCategory === cat.id ? '#171717' : '#ececec',
                                    fontSize: 14, fontWeight: 500, cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: 24 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
                        {categories.find(c => c.id === activeCategory)?.label}
                    </h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                        {filteredAgents.map(agent => (
                            <div key={agent.id} style={{
                                background: '#212121', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'border-color 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                            >
                                <div style={{ fontSize: 40, marginBottom: 16 }}>{agent.icon}</div>
                                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{agent.name}</div>
                                <div style={{ fontSize: 14, color: '#8e8ea0', lineHeight: 1.5 }}>{agent.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
