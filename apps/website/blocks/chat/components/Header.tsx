'use client';

import React, { useState, useEffect } from 'react';
import type { Model } from '../config/providers';
import { MODELS, PROVIDERS } from '../config/providers';
import { Tooltip, TooltipTrigger, TooltipContent } from '@treonstudio/bungas-core/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@treonstudio/bungas-core/ui/dropdown-menu';
import { BellOutline, InfoCircleOutline, ShieldWarningOutline, DangerTriangleOutline, CheckCircleOutline } from 'solar-icon-set';

// ─── ICONS ───────────────────────────────────────────────────────────────────
const IconSidebarToggle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
  </svg>
);

const IconNewChat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const IconShare = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

// Group models by provider
function groupedModels(): { providerId: string; providerName: string; models: Model[] }[] {
  const groups: Record<string, { providerName: string; models: Model[] }> = {};
  for (const model of MODELS) {
    if (!groups[model.provider]) {
      groups[model.provider] = { providerName: PROVIDERS[model.provider]?.name || model.provider, models: [] };
    }
    groups[model.provider].models.push(model);
  }
  return Object.entries(groups).map(([providerId, g]) => ({ providerId, ...g }));
}

// ─── MODEL PICKER DROPDOWN ────────────────────────────────────────────────────
function ModelPicker({ selected, onChange }: { selected: Model; onChange: (m: Model) => void }) {
  const groups = groupedModels();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8, border: 'none',
            background: 'transparent',
            color: '#ececec', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', maxWidth: '100%', overflow: 'hidden',
          }}
        >
          <span style={{ color: '#8e8ea0', fontWeight: 500, fontSize: 12, flexShrink: 0 }}>{PROVIDERS[selected.provider]?.name}:</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.label}</span>
          <span style={{ color: '#8e8ea0', marginTop: 1 }}><IconChevronDown /></span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        style={{
          background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: 4, minWidth: 260, maxHeight: 400, overflowY: 'auto',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        }}
        sideOffset={8}
      >
        {groups.map((group) => (
          <React.Fragment key={group.providerId}>
            <div style={{
              padding: '8px 10px 4px', fontSize: 11, fontWeight: 600,
              color: '#5a5a6b', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {group.providerName}
            </div>
            {group.models.map((m) => (
              <DropdownMenuItem
                key={m.id}
                onSelect={() => onChange(m)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
                  background: m.id === selected.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: '#ececec', fontSize: 13,
                }}
              >
                <div>
                  <div style={{ fontWeight: m.id === selected.id ? 600 : 400 }}>{m.label}</div>
                  {m.description && <div style={{ fontSize: 11, color: '#8e8ea0' }}>{m.description}</div>}
                </div>
                {m.id === selected.id && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10a37f" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </DropdownMenuItem>
            ))}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── NOTIFICATION CENTER ──────────────────────────────────────────────────────
type TNotification = {
  id: string
  user_id: string
  category: string
  title: string
  body: string
  link: string | null
  read_at: string | null
  created_at: string
}

function NotificationCenter() {
  const [notifications, setNotifications] = useState<TNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = () => {
    fetch('/api/notifications')
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setNotifications(result.data)
          const unread = result.data.filter((n: TNotification) => !n.read_at).length
          setUnreadCount(unread)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchNotifications()
    // Poll every 30 seconds for B2B announcements
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      const result = await res.json()
      if (result.success) {
        fetchNotifications()
      }
    } catch {}
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: '50%', border: 'none',
            background: 'transparent', color: '#8e8ea0', cursor: 'pointer',
            position: 'relative', transition: 'background 0.1s, color 0.1s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#ececec'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
        >
          <BellOutline style={{ width: 16, height: 16 }} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute', top: 6, right: 6,
                height: 8, width: 8, borderRadius: '50%',
                background: '#9B5B3E', border: '1.5px solid #212121',
              }}
            />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        style={{
          background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: 4, minWidth: 320, maxWidth: 360, maxHeight: 300, overflowY: 'auto',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        }}
        sideOffset={8}
        align="end"
      >
        <div style={{
          padding: '8px 10px 6px', fontSize: 11, fontWeight: 600,
          color: '#8e8ea0', borderBottom: '1px solid rgba(255,255,255,0.06)',
          textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between'
        }}>
          <span>Notifikasi Anda</span>
          {unreadCount > 0 && <span style={{ color: '#9B5B3E' }}>{unreadCount} Baru</span>}
        </div>

        {notifications.length > 0 ? (
          notifications.map((n) => {
            const isUnread = !n.read_at
            const Icon =
              n.category === 'crisis' ? ShieldWarningOutline :
              n.category === 'alert' ? DangerTriangleOutline :
              InfoCircleOutline

            return (
              <DropdownMenuItem
                key={n.id}
                onSelect={() => { if (isUnread) handleMarkAsRead(n.id); }}
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '10px', borderRadius: 7, cursor: 'pointer',
                  background: isUnread ? 'rgba(155, 91, 62, 0.05)' : 'transparent',
                  borderLeft: isUnread ? '3px solid #9B5B3E' : '3px solid transparent',
                  color: '#ececec', fontSize: 12, transition: 'background 0.1s',
                  outline: 'none',
                }}
              >
                <Icon style={{ width: 14, height: 14, marginTop: 2, flexShrink: 0, color: n.category === 'crisis' ? '#ef4444' : n.category === 'alert' ? '#f59e0b' : '#9B5B3E' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: isUnread ? 700 : 500, color: isUnread ? '#fff' : '#c5c5d2' }}>{n.title}</div>
                  <div style={{ color: '#8e8ea0', fontSize: 11, marginTop: 2, lineHeight: '1.4' }}>{n.body}</div>
                  <div style={{ color: '#5a5a6b', fontSize: 10, marginTop: 4, fontFamily: 'monospace' }}>{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {isUnread && <div style={{ height: 6, width: 6, borderRadius: '50%', background: '#9B5B3E', marginTop: 6, flexShrink: 0 }} />}
              </DropdownMenuItem>
            )
          })
        ) : (
          <div style={{ padding: '24px 10px', textAlign: 'center', color: '#8e8ea0', fontSize: 12 }}>Belum ada notifikasi.</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── HEADER ──────────────────────────────────────────────────────────────────
interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  selectedModel: Model;
  onModelChange: (m: Model) => void;
  hasMessages: boolean;
  onShare?: () => void;
  onEndSession?: () => void;
  sessionSummaryOpen?: boolean;
}

export default function Header({
  sidebarOpen,
  onToggleSidebar,
  onNewChat,
  selectedModel,
  onModelChange,
  hasMessages,
  onShare,
  onEndSession,
  sessionSummaryOpen = false,
}: HeaderProps) {
  return (
    <div style={{
      height: 52,
      display: 'flex',
      alignItems: 'center',
      padding: '0 10px',
      gap: 4,
      flexShrink: 0,
      borderBottom: hasMessages ? '1px solid rgba(255,255,255,0.06)' : 'none',
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Show icon controls only when sidebar is closed */}
      {!sidebarOpen && (
        <>
          <HeaderIconBtn title="Toggle sidebar" onClick={onToggleSidebar}>
            <IconSidebarToggle />
          </HeaderIconBtn>
          <HeaderIconBtn title="New chat" onClick={onNewChat}>
            <IconNewChat />
          </HeaderIconBtn>
        </>
      )}

      {/* Model selector */}
      <ModelPicker selected={selectedModel} onChange={onModelChange} />

      <div style={{ flex: 1 }} />

      {/* Real-time In-App Notification Bell Dropdown */}
      <NotificationCenter />

      {/* Selesaikan Sesi button (visible if B2B conversation exists and not open) */}
      {hasMessages && onEndSession && !sessionSummaryOpen && (
        <button
          onClick={onEndSession}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(155, 91, 62, 0.2)',
            background: 'rgba(155, 91, 62, 0.1)', color: '#9B5B3E', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.12s, color 0.12s, border-color 0.12s',
            fontFamily: "'Inter', sans-serif",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#9B5B3E';
            (e.currentTarget as HTMLElement).style.color = '#ffffff';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(155, 91, 62, 0.1)';
            (e.currentTarget as HTMLElement).style.color = '#9B5B3E';
          }}
        >
          Selesaikan Sesi
        </button>
      )}

      {/* Share button (visible if conversation exists) */}
      {hasMessages && (
        <button onClick={() => onShare?.()} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
          background: 'transparent', color: '#8e8ea0', fontSize: 13,
          cursor: 'pointer', transition: 'background 0.12s, color 0.12s, border-color 0.12s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
          (e.currentTarget as HTMLElement).style.color = '#ececec';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = '#8e8ea0';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
        }}
        >
          <IconShare /> Share
        </button>
      )}
    </div>
  );
}

function HeaderIconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          style={{
            width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 7, border: 'none', background: 'transparent', color: '#8e8ea0',
            cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#ececec'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8} style={{ background: '#000', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, border: '1px solid rgba(255,255,255,0.1)', zIndex: 100000, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontFamily: "'Inter', sans-serif" }}>
        {title}
      </TooltipContent>
    </Tooltip>
  );
}
