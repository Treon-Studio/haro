'use client';

import React from 'react';
import { CloudLogo } from '@/components/ui/svgs/cloud-logo';

const PROMPTS = [
  { text: 'Write a cover letter for a software engineer role' },
  { text: 'Explain quantum computing in simple terms' },
  { text: 'Brainstorm names for a productivity startup' },
  { text: 'Create a content calendar for a tech blog' },
];

interface LandingProps {
  onPromptSelect: (text: string) => void;
  sessionCount?: number;
  daysAbsent?: number;
}

export default function Landing({ onPromptSelect, sessionCount = 0, daysAbsent = 0 }: LandingProps) {
  const hour = new Date().getHours();
  
  // B2B Clinical Protocol Greetings (CHAT-13, CHAT-15)
  let greetingText = '';
  if (sessionCount === 0) {
    greetingText = "Hi, I'm here to listen. Whatever's on your mind today, we can take it at your pace. How are you feeling right now?";
  } else if (daysAbsent >= 30) {
    greetingText = "Welcome back. I remember some of what you shared before, but there's no rush to pick up where we left off. What's on your mind today?";
  } else {
    const dayGreeting =
      hour >= 0 && hour < 5  ? 'Good night'
      : hour < 12             ? 'Good morning'
      : hour < 17             ? 'Good afternoon'
      :                         'Good evening';
    greetingText = `Hello, ${dayGreeting}! What is on your mind today?`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '0 16px 24px', maxWidth: 600 }}>
      {/* Icon + Greeting */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {/* Cloud Logo */}
        <CloudLogo />

        {/* Greeting */}
        <h1 style={{ margin: '0 0 8px 0', fontSize: 24, fontWeight: 500, color: '#ececec', letterSpacing: '-0.02em', textAlign: 'center', lineHeight: '1.4', padding: '0 24px' }}>
          {greetingText}
        </h1>
      </div>

      {/* Suggestion prompts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 560 }}>
        {PROMPTS.map((p, i) => (
          <button
            key={i}
            onClick={() => onPromptSelect(p.text)}
            style={{
              display: 'flex', alignItems: 'flex-start',
              padding: '14px 16px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#c5c5d2', fontSize: 13, lineHeight: '1.5',
              textAlign: 'left', cursor: 'pointer',
              transition: 'background 0.12s, border-color 0.12s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            {p.text}
          </button>
        ))}
      </div>
    </div>
  );
}