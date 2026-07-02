'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@treonstudio/bungas-core/ui/tooltip';
import type { AttachedFile } from '../hooks/useChat';
import MentionPopover from './MentionPopover';
import CommandsPopover from './CommandsPopover';
import { PaperclipOutline, GlobalOutline, GalleryOutline, SendSquareOutline, StopOutline, MicrophoneOutline, CloseCircleOutline } from 'solar-icon-set';

interface ChatFormProps {
  onSend: (text: string, files?: AttachedFile[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  webSearch?: boolean;
  onWebSearchChange?: (value: boolean) => void;
  placeholder?: string;
  isLanding?: boolean;
  replyingTo?: { id: string; content: string; role: string } | null;
  onCancelReply?: () => void;
  isQuotaExceeded?: boolean;
}

export default function ChatForm({
  onSend,
  onStop,
  isStreaming,
  webSearch = false,
  onWebSearchChange,
  placeholder = 'Message TenangAI',
  isLanding = false,
  replyingTo,
  onCancelReply,
  isQuotaExceeded = false,
}: ChatFormProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [commandQuery, setCommandQuery] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const processFiles = useCallback((fileList: FileList | File[]) => {
    Array.from(fileList).forEach((file) => {
      const id = crypto.randomUUID();
      const base: AttachedFile = { id, name: file.name, size: file.size, type: file.type };
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachments((prev) => [...prev, { ...base, dataUrl: e.target?.result as string }]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachments((prev) => [...prev, base]);
      }
    });
  }, []);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  useEffect(() => { autoResize(); }, [value, autoResize]);

  const handleSend = useCallback(() => {
    const text = value.trim();
    if ((!text && attachments.length === 0) || isStreaming) return;
    onSend(text, attachments);
    setValue('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [value, attachments, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') { setMentionQuery(null); setCommandQuery(null); }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !isStreaming;

  if (isQuotaExceeded) {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: 768,
          padding: '16px 20px',
          borderRadius: '16px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          background: 'rgba(239, 68, 68, 0.04)',
          color: '#ef4444',
          fontSize: 13,
          lineHeight: '1.6',
          textAlign: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        }}
      >
        Perusahaan Anda telah mencapai batas kuota obrolan bulan ini. Silakan hubungi HR Admin Anda untuk mengupgrade paket layanan.
      </div>
    );
  }

  return (
    <div
      style={{ width: '100%', maxWidth: 768, position: 'relative' }}
      onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) { setIsDragging(false); } }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files); }}
    >
      {/* Popovers */}
      {mentionQuery !== null && (
        <MentionPopover query={mentionQuery} onSelect={(label) => { setValue((prev) => prev.replace(/@\w*$/, label)); setMentionQuery(null); textareaRef.current?.focus(); }} onClose={() => setMentionQuery(null)} />
      )}
      {commandQuery !== null && (
        <CommandsPopover query={commandQuery} onSelect={(content) => { setValue((prev) => prev.replace(/(?:^|\n)\/\w*$/, content)); setCommandQuery(null); textareaRef.current?.focus(); }} onClose={() => setCommandQuery(null)} />
      )}

      {/* Main input box */}
      <div
        style={{
          background: '#2f2f2f',
          borderRadius: 16,
          border: isDragging
            ? '1px solid rgba(16,163,127,0.5)'
            : isFocused
              ? '1px solid rgba(255,255,255,0.18)'
              : '1px solid rgba(255,255,255,0.1)',
          boxShadow: isFocused
            ? '0 0 0 3px rgba(16,163,127,0.12), 0 4px 24px rgba(0,0,0,0.3)'
            : '0 2px 12px rgba(0,0,0,0.25)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          overflow: 'hidden',
        }}
        onClick={() => textareaRef.current?.focus()}
      >
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 16px 0' }}>
            {attachments.map((file) => (
              <div key={file.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 180 }}>
                {file.dataUrl ? (
                  <img src={file.dataUrl} alt={file.name} style={{ width: 44, height: 44, objectFit: 'cover' }} />
                ) : (
                  <span style={{ padding: '8px 12px', fontSize: 12, color: '#ececec' }}>📄 {file.name}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setAttachments((prev) => prev.filter((f) => f.id !== file.id)); }}
                  style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                >
                  <CloseCircleOutline style={{ width: 10, height: 10 }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Reply indicator */}
        {replyingTo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 0', fontSize: 12, color: '#8e8ea0' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(16,163,127,0.08)', border: '1px solid rgba(16,163,127,0.2)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10a37f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
              </svg>
              <span style={{ color: '#10a37f', fontWeight: 500 }}>Replying to {replyingTo.role === 'user' ? 'your message' : 'assistant'}</span>
              <span style={{ color: '#6b6b7b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                {replyingTo.content.length > 50 ? replyingTo.content.slice(0, 50) + '…' : replyingTo.content}
              </span>
            </div>
            <button
              onClick={() => onCancelReply?.()}
              style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'transparent', color: '#8e8ea0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <CloseCircleOutline style={{ width: 14, height: 14 }} />
            </button>
          </div>
        )}

        {/* Textarea */}
        <div style={{ padding: '12px 16px 0' }}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              const val = e.target.value;
              setValue(val);
              const atMatch = val.match(/@(\w*)$/);
              if (atMatch) { setMentionQuery(atMatch[1]); setCommandQuery(null); }
              else setMentionQuery(null);
              const slashMatch = val.match(/(?:^|\n)\/(\w*)$/);
              if (slashMatch) { setCommandQuery(slashMatch[1]); setMentionQuery(null); }
              else if (!atMatch) setCommandQuery(null);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            rows={1}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: '#ececec',
              fontSize: 16,
              lineHeight: '1.65',
              minHeight: 28,
              maxHeight: 200,
              overflowY: 'auto',
              fontFamily: 'inherit',
              caretColor: '#10a37f',
            }}
          />
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px' }}>
          {/* Attach */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'transparent', color: '#8e8ea0', cursor: 'pointer', transition: 'background 0.1s, color 0.1s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#ececec'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
              >
                <PaperclipOutline style={{ width: 16, height: 16 }} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Attach file</TooltipContent>
          </Tooltip>

          {/* Web search toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onWebSearchChange?.(!webSearch)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 20, border: 'none',
                  background: webSearch ? 'rgba(16,163,127,0.15)' : 'transparent',
                  color: webSearch ? '#10a37f' : '#8e8ea0',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={e => { if (!webSearch) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#ececec'; }}}
                onMouseLeave={e => { if (!webSearch) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}}
              >
                <GlobalOutline style={{ width: 15, height: 15 }} />
                Search
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Search the web</TooltipContent>
          </Tooltip>

          {/* Image */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'transparent', color: '#8e8ea0', cursor: 'pointer', transition: 'background 0.1s, color 0.1s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#ececec'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
              >
                <GalleryOutline style={{ width: 16, height: 16 }} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Create image</TooltipContent>
          </Tooltip>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Mic */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'transparent', color: '#8e8ea0', cursor: 'pointer', transition: 'background 0.1s, color 0.1s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#ececec'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
              >
                <MicrophoneOutline style={{ width: 16, height: 16 }} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Voice input</TooltipContent>
          </Tooltip>

          {/* Send / Stop */}
          {isStreaming ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onStop}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', background: 'transparent', color: '#ececec', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <StopOutline style={{ width: 13, height: 13, fill: 'currentColor' }} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Stop generating</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 34, height: 34, borderRadius: '50%', border: 'none',
                    background: canSend ? '#ececec' : 'rgba(255,255,255,0.1)',
                    color: canSend ? '#212121' : '#6b6b6b',
                    cursor: canSend ? 'pointer' : 'not-allowed',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  <SendSquareOutline style={{ width: 15, height: 15 }} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Send message</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}