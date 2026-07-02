'use client';
import React, { useState, useEffect } from 'react';

type SearchResult = {
    id: string;
    role: string;
    content: string;
    date: string;
    chat: string;
};

export default function SearchView() {
    const [search, setSearch] = useState('');
    const [conversations, setConversations] = useState<any[]>([]);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchConversations = async () => {
            try {
                const res = await fetch('/api/conversations');
                const data = await res.json();
                if (data.conversations) {
                    setConversations(data.conversations);
                }
            } catch (err) {
                console.error("Failed to fetch conversations", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchConversations();
    }, []);

    useEffect(() => {
        if (!search.trim()) {
            setResults([]);
            return;
        }

        const query = search.toLowerCase();
        const matches: SearchResult[] = [];

        conversations.forEach((conv) => {
            if (!conv.messages) return;
            conv.messages.forEach((msg: any) => {
                if (msg.content && msg.content.toLowerCase().includes(query)) {
                    matches.push({
                        id: msg.id || Math.random().toString(),
                        role: msg.role,
                        content: msg.content.length > 150 ? msg.content.substring(0, 150) + '...' : msg.content,
                        date: new Date(msg.createdAt).toLocaleDateString(),
                        chat: conv.title || 'Untitled Chat',
                    });
                }
            });
        });

        setResults(matches);
    }, [search, conversations]);

    return (
        <div style={{ height: '100vh', width: '100%', background: '#171717', color: '#ececec', fontFamily: "'Inter', sans-serif", overflowY: 'auto' }}>
            <div style={{ maxWidth: 768, margin: '0 auto', padding: '48px 24px' }}>
                <div style={{ marginBottom: 32 }}>
                    <input 
                        type="text" 
                        placeholder="Search all conversations..." 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                        style={{
                            width: '100%', padding: '16px 20px', borderRadius: 12,
                            background: '#212121', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#ececec', fontSize: 18, outline: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                    />
                </div>

                {isLoading ? (
                    <div style={{ textAlign: 'center', color: '#8e8ea0', paddingTop: 64 }}>
                        Loading conversations...
                    </div>
                ) : search.length > 0 ? (
                    <div>
                        <div style={{ fontSize: 13, color: '#8e8ea0', marginBottom: 16 }}>
                            Showing results for "{search}"
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {results.length > 0 ? results.map((msg, i) => (
                                <div key={msg.id + i} style={{
                                    background: '#212121', border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: 8, padding: 16, cursor: 'pointer', transition: 'background 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                onMouseLeave={e => e.currentTarget.style.background = '#212121'}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: '#8e8ea0' }}>
                                        <span style={{ fontWeight: 600, color: msg.role === 'user' ? '#ececec' : '#10a37f' }}>
                                            {msg.role === 'user' ? 'You' : 'Assistant'}
                                        </span>
                                        <span>{msg.date} &middot; in {msg.chat}</span>
                                    </div>
                                    <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                                        {msg.content}
                                    </div>
                                </div>
                            )) : (
                                <div style={{ textAlign: 'center', color: '#8e8ea0', padding: 32 }}>
                                    No matches found.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', color: '#8e8ea0', paddingTop: 64 }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                        <p>Search across all your chats and messages.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
