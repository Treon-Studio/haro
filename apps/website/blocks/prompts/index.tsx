'use client';
import React, { useState } from 'react';

export default function PromptsView() {
    const [search, setSearch] = useState('');

    const MOCK_PROMPTS = [
        { id: '1', name: 'Code Reviewer', category: 'Development', text: 'Act as a senior engineer reviewing this code. Point out bugs, style issues, and performance improvements.' },
        { id: '2', name: 'Blog Post Writer', category: 'Writing', text: 'Write a comprehensive blog post about [Topic] targeting [Audience]. Ensure the tone is engaging and SEO-optimized.' },
        { id: '3', name: 'Language Tutor', category: 'Education', text: 'You are a Spanish tutor. Let\'s have a conversation where you correct my mistakes and explain grammar rules gently.' },
    ];

    const filtered = MOCK_PROMPTS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div style={{ height: '100vh', width: '100%', background: '#171717', color: '#ececec', fontFamily: "'Inter', sans-serif", overflowY: 'auto' }}>
            <div style={{ maxWidth: 896, margin: '0 auto', padding: '48px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <h1 style={{ fontSize: 32, fontWeight: 700 }}>System Prompts</h1>
                    <button style={{
                        padding: '8px 16px', background: '#10a37f', color: '#fff',
                        border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer'
                    }}>
                        + Create Prompt
                    </button>
                </div>

                <div style={{ marginBottom: 32 }}>
                    <input 
                        type="text" 
                        placeholder="Search prompts..." 
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
                    {filtered.map(prompt => (
                        <div key={prompt.id} style={{
                            background: '#212121', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'border-color 0.2s',
                            display: 'flex', flexDirection: 'column'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <div style={{ fontSize: 16, fontWeight: 600 }}>{prompt.name}</div>
                                <span style={{ fontSize: 12, padding: '2px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#c5c5d2' }}>
                                    {prompt.category}
                                </span>
                            </div>
                            <div style={{ fontSize: 14, color: '#8e8ea0', lineHeight: 1.5, flex: 1 }}>
                                {prompt.text}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <button style={{ background: 'transparent', border: 'none', color: '#10a37f', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                                    Use Prompt
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
