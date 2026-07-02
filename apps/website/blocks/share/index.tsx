'use client';

import React, { useState, useEffect } from 'react';
import Header from '../chat/components/Header';
import MessagesView from '../chat/components/MessagesView';
import type { Message } from '../chat/hooks/useChat';

export default function ShareView({ shareId }: { shareId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState('Shared Conversation');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConversation = async () => {
      try {
        const res = await fetch(`/api/conversations/${shareId}`);
        const data = await res.json();
        if (data && data.messages) {
          setMessages(data.messages);
          if (data.title) setTitle(data.title);
        }
      } catch (err) {
        console.error('Failed to fetch shared conversation:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversation();
  }, [shareId]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100vh', background: '#212121', color: '#ececec',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Fake Header for Shared View */}
      <div style={{
        height: 60, borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 20px', background: '#171717'
      }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
        <div style={{ position: 'absolute', right: 20 }}>
          <button style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: '#10a37f', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer'
          }} onClick={() => window.location.href = '/'}>Continue this chat</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#8e8ea0' }}>Loading conversation...</div>
        ) : messages.length > 0 ? (
          <MessagesView messages={messages} onRetry={() => {}} />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#8e8ea0' }}>Conversation not found or empty.</div>
        )}
      </div>
    </div>
  );
}
