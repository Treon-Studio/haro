'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Message } from '../hooks/useChat';
import { Tooltip, TooltipTrigger, TooltipContent } from '@treonstudio/bungas-core/ui/tooltip';
import { Skeleton } from '@treonstudio/bungas-core/ui/skeleton';
import { MessageContent } from '@treonstudio/bungas-core/ui/chat/message-content';
import { CloudLogo } from '@/components/ui/svgs/cloud-logo';

// ─── ICONS ───────────────────────────────────────────────────────────────────
const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const IconRetry = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.75"/>
  </svg>
);
const IconThumbUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
  </svg>
);
const IconThumbDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
  </svg>
);
const IconChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IconReply = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
  </svg>
);
const IconRegenerate = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);
const IconThumbUpFilled = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
  </svg>
);
const IconThumbDownFilled = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
  </svg>
);

// ─── LOADING DOTS ─────────────────────────────────────────────────────────────
function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '8px 0' }}>
      {[0, 1, 2].map((i) => (
        <Skeleton
          key={i}
          style={{
            width: 7, height: 7, borderRadius: '50%',
            animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const FEEDBACK_PREFIX = 'tenang:feedback:';

function getFeedback(id: string): 'up' | 'down' | null {
  try {
    const v = localStorage.getItem(FEEDBACK_PREFIX + id);
    if (v === 'up' || v === 'down') return v;
  } catch { /* noop */ }
  return null;
}

function toggleFeedback(id: string, value: 'up' | 'down'): 'up' | 'down' | null {
  const current = getFeedback(id);
  if (current === value) {
    localStorage.removeItem(FEEDBACK_PREFIX + id);
    return null;
  }
  localStorage.setItem(FEEDBACK_PREFIX + id, value);
  return value;
}

function getDisplaySettings() {
  try {
    const raw = localStorage.getItem('tenang:display');
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return { timestamps: false, compact: false, showModel: true, fontSize: 14 };
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function useDisplaySettings() {
  const [settings, setSettings] = useState(getDisplaySettings);
  useEffect(() => {
    const handler = () => setSettings(getDisplaySettings());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  return settings;
}

// ─── ACTION BUTTON ────────────────────────────────────────────────────────────
function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 8px', borderRadius: 6,
            border: 'none', background: 'transparent',
            color: '#8e8ea0', fontSize: 12, cursor: 'pointer',
            transition: 'background 0.1s, color 0.1s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#ececec'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} style={{ background: '#000', color: '#fff', padding: '5px 9px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid rgba(255,255,255,0.1)', zIndex: 100000, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── USER MESSAGE ─────────────────────────────────────────────────────────────
function UserMessage({ message, onEditAndResend, onReply }: { message: Message; onEditAndResend: (id: string, content: string) => void; onReply?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const settings = useDisplaySettings();

  const handleSubmit = () => {
    if (draft.trim() && draft.trim() !== message.content) {
      onEditAndResend(message.id, draft.trim());
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
              if (e.key === 'Escape') setEditing(false);
            }}
            style={{ width: '100%', background: '#3f3f3f', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px', color: '#ececec', fontSize: 15, resize: 'none', outline: 'none', lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box' }}
            rows={3}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button onClick={() => setEditing(false)} style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#8e8ea0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSubmit} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', background: '#10a37f', color: 'white', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Send</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Attachments */}
      {message.attachments && message.attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6, justifyContent: 'flex-end' }}>
          {message.attachments.map((file) => (
            <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#3a3a3a', borderRadius: 8, overflow: 'hidden', fontSize: 12, color: '#ececec', maxWidth: 200 }}>
              {file.dataUrl ? (
                <img src={file.dataUrl} alt={file.name} style={{ width: 40, height: 40, objectFit: 'cover' }} />
              ) : (
                <span style={{ padding: '6px 10px' }}>📄 {file.name}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Timestamp */}
      {settings.timestamps && (
        <div style={{ fontSize: 11, color: '#5a5a6b', marginBottom: 2, marginRight: 4 }}>{formatTime(message.createdAt)}</div>
      )}

      {/* Reply indicator */}
      {message.replyTo && (
        <div style={{ fontSize: 12, color: '#8e8ea0', marginBottom: 4, padding: '4px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, borderRight: '2px solid #10a37f', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          Replying to {message.replyTo.content.length > 60 ? message.replyTo.content.slice(0, 60) + '…' : message.replyTo.content}
          <IconReply />
        </div>
      )}

      {/* Message bubble */}
      <div style={{
        maxWidth: '75%',
        background: '#2f2f2f',
        color: '#ececec',
        borderRadius: '18px 18px 4px 18px',
        padding: '12px 18px',
        fontSize: 15,
        lineHeight: '1.65',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        boxSizing: 'border-box',
      }}>
        <MessageContent content={message.content} citations={message.citations} />
      </div>
      {hovered && (
        <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
          <button
            onClick={() => { setDraft(message.content); setEditing(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 6,
              border: 'none', background: 'transparent',
              color: '#8e8ea0', fontSize: 12, cursor: 'pointer',
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#ececec'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button
            onClick={() => onReply?.()}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 6,
              border: 'none', background: 'transparent',
              color: '#8e8ea0', fontSize: 12, cursor: 'pointer',
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#ececec'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
          >
            <IconReply /> Reply
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ASSISTANT MESSAGE ────────────────────────────────────────────────────────
function AssistantMessage({ message, onCopy, onRetry, onReply, onRegenerate }: { message: Message; onCopy: () => void; onRetry: () => void; onReply?: () => void; onRegenerate?: () => void }) {
  const [fb, setFb] = React.useState<'up' | 'down' | null>(() => getFeedback(message.id));
  const settings = useDisplaySettings();

  const handleFeedback = (value: 'up' | 'down') => {
    const result = toggleFeedback(message.id, value);
    setFb(result);
  };

  return (
    <div>
      <div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {/* Avatar */}
          <CloudLogo style={{ width: 32, height: 32, flexShrink: 0, margin: 0 }} />

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            {/* Timestamp */}
            {settings.timestamps && (
              <div style={{ fontSize: 11, color: '#5a5a6b', marginBottom: 4 }}>{formatTime(message.createdAt)}</div>
            )}

            {/* Reply indicator */}
            {message.replyTo && (
              <div style={{ fontSize: 12, color: '#8e8ea0', marginBottom: 4, padding: '4px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, borderLeft: '2px solid #10a37f', display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconReply />
                Replying to {message.replyTo.content.length > 60 ? message.replyTo.content.slice(0, 60) + '…' : message.replyTo.content}
              </div>
            )}

            {/* Text */}
            <div style={{ color: '#ececec', fontSize: 15, lineHeight: '1.75', wordBreak: 'break-word', overflowWrap: 'break-word', width: '100%' }}>
              {message.isStreaming && !message.content ? (
                <LoadingDots />
              ) : (
                <MessageContent content={message.content} citations={message.citations} />
              )}
              {message.isStreaming && message.content && (
                <span style={{ display: 'inline-block', width: 2, height: 16, background: '#10a37f', marginLeft: 1, verticalAlign: 'middle', animation: 'blink 0.8s step-end infinite' }} />
              )}
            </div>

            {/* Error */}
            {message.error && (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 14, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                Something went wrong generating a response.{' '}
                <button onClick={onRetry} style={{ color: '#fca5a5', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}>
                  Try again
                </button>
              </div>
            )}

            {/* Actions */}
            {!message.isStreaming && !message.error && (
              <div style={{ display: 'flex', gap: 0, marginTop: 4 }}>
                <ActionBtn icon={<IconCopy />} label="Copy" onClick={onCopy} />
                <ActionBtn icon={<IconReply />} label="Reply" onClick={() => onReply?.()} />
                <ActionBtn icon={<IconRegenerate />} label="Regenerate" onClick={() => onRegenerate?.()} />
                <ActionBtn icon={fb === 'up' ? <IconThumbUpFilled /> : <IconThumbUp />} label="Good response" onClick={() => handleFeedback('up')} />
                <ActionBtn icon={fb === 'down' ? <IconThumbDownFilled /> : <IconThumbDown />} label="Bad response" onClick={() => handleFeedback('down')} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MESSAGES VIEW ────────────────────────────────────────────────────────────
interface MessagesViewProps {
  messages: Message[];
  onRetry: () => void;
  onEditAndResend: (messageId: string, newContent: string) => void;
  onReply?: (message: Message) => void;
  onRegenerate?: (messageId: string) => void;
}

export default function MessagesView({ messages, onRetry, onEditAndResend, onReply, onRegenerate }: MessagesViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isNearBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => setShowScrollBtn(!isNearBottom());
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [isNearBottom]);

  const handleCopy = (content: string) => navigator.clipboard.writeText(content).catch(() => {});

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        width: '100%',
        minWidth: 0,
      }}
    >
      {/* Centered messages column */}
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '56px 24px 48px',
        boxSizing: 'border-box',
        width: '100%',
      }}>
        {messages.map((msg) =>
          msg.role === 'user' ? (
            <div key={msg.id} style={{ marginBottom: 24 }}>
              <UserMessage message={msg} onEditAndResend={onEditAndResend} onReply={() => onReply?.(msg)} />
            </div>
          ) : (
            <div key={msg.id} style={{ marginBottom: 24 }}>
              <AssistantMessage
                message={msg}
                onCopy={() => handleCopy(msg.content)}
                onRetry={onRetry}
                onReply={() => onReply?.(msg)}
                onRegenerate={() => onRegenerate?.(msg.id)}
              />
            </div>
          )
        )}
        <div ref={messagesEndRef} style={{ height: 0 }} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          style={{
            position: 'sticky',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.12)',
            background: '#2a2a2e',
            color: '#ececec',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            transition: 'transform 100ms ease',
            zIndex: 10,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
          title="Scroll to bottom"
        >
          <IconChevronDown />
        </button>
      )}
    </div>
  );
}
