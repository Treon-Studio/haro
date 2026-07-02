'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Conversation } from '../hooks/useChat';
import { Tooltip, TooltipTrigger, TooltipContent } from '@treonstudio/bungas-core/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@treonstudio/bungas-core/ui/dropdown-menu';
import SkillsSidebar from '../../skills/SkillsSidebar';
import { PromptSidebar } from '../../prompts/PromptSidebar';
import MemoriesSidebar from './MemoriesSidebar';
import BookmarksSidebar from './BookmarksSidebar';
import FilesSidebar from './FilesSidebar';
import AgentsSidebar from './AgentsSidebar';
import SearchSidebar from './SearchSidebar';

// ─── ICONS ──────────────────────────────────────────────────────────────────
const IconSidebarToggle = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
    </svg>
);

const IconNewChat = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
);

const IconChats = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
);

const IconAgents = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2"></rect>
        <circle cx="12" cy="5" r="2"></circle>
        <path d="M12 7v4"></path>
        <line x1="8" y1="16" x2="8" y2="16"></line>
        <line x1="16" y1="16" x2="16" y2="16"></line>
    </svg>
);

const IconPrompts = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
);

const IconFiles = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
    </svg>
);


const IconSkills = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
);

const IconBrain = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.9 1.25 2.5 2.5 0 0 1-2.4-2.44 2.5 2.5 0 0 1-.95-4.56 2.5 2.5 0 0 1 1.05-4.45 2.5 2.5 0 0 1 3.2-6.5A2.5 2.5 0 0 1 9.5 2Z"></path>
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.9 1.25 2.5 2.5 0 0 0 2.4-2.44 2.5 2.5 0 0 0 .95-4.56 2.5 2.5 0 0 0-1.05-4.45 2.5 2.5 0 0 0-3.2-6.5A2.5 2.5 0 0 0 14.5 2Z"></path>
    </svg>
);

const IconBookmark = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
    </svg>
);

const IconPaperclip = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
    </svg>
);

const IconSearch = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
);

const IconGrid = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
    </svg>
);

const IconFolder = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
);

const IconPlus = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

const IconEdit = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
);

const IconTrash = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
);

const IconDots = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
    </svg>
);

const IconChevronDown = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
);


// ─── DROPDOWN ITEM ──────────────────────────────────────────────────────────
function DropdownItem({ label, onClick, danger = false }: { label: string; onClick?: () => void; danger?: boolean }) {
    return (
        <button
            onClick={onClick}
            style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', borderRadius: 6, border: 'none', background: 'transparent',
                color: danger ? '#ff6b6b' : '#ececec', fontSize: 13, cursor: 'pointer',
                textAlign: 'left', transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
            {label}
        </button>
    );
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function getGroupLabel(date: Date): 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Older' {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff <= 7) return 'Previous 7 Days';
    return 'Older';
}

type GroupKey = 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Older';

// ─── CONVERSATION ITEM ───────────────────────────────────────────────────────
function ConvItem({ conv, isActive, onSelect, onDelete }: { conv: Conversation; isActive: boolean; onSelect: () => void; onDelete: () => void; }) {
    const [hovered, setHovered] = useState(false);

    return (
        <DropdownMenu>
            <div
                style={{
                    position: 'relative', width: '100%', display: 'flex', alignItems: 'center',
                    padding: '8px 10px', borderRadius: 8,
                    background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: isActive ? '#ececec' : '#c5c5d2', textAlign: 'left', fontSize: 13,
                    cursor: 'pointer', border: 'none', transition: 'background 0.1s', gap: 8,
                }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onClick={onSelect}
            >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.title}
                </span>
                {(hovered || isActive) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuTrigger asChild>
                            <button
                                style={{
                                    width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    borderRadius: 5, color: '#8e8ea0', border: 'none', background: 'transparent', cursor: 'pointer',
                                    transition: 'background 0.1s, color 0.1s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = '#ececec'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
                            >
                                <IconDots />
                            </button>
                        </DropdownMenuTrigger>
                    </div>
                )}
            </div>
            <DropdownMenuContent
                style={{
                    background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: 4, minWidth: 140, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}
                sideOffset={4}
                align="end"
            >
                <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', borderRadius: 6, border: 'none', background: 'transparent',
                        color: '#ff6b6b', fontSize: 12, cursor: 'pointer', transition: 'background 0.1s',
                    }}
                >
                    <IconTrash /> Delete conversation
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// ─── NAV BUTTON (ICON STRIP) ──────────────────────────────────────────────────
function NavIconButton({
    title, onClick, children, active = false,
}: {
    title: string; onClick: () => void; children: React.ReactNode; active?: boolean;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={onClick}
                    style={{
                        width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 8, border: 'none',
                        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: active ? '#ececec' : '#8e8ea0',
                        cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
                    }}
                    onMouseEnter={e => {
                        if (!active) {
                            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                            (e.currentTarget as HTMLElement).style.color = '#ececec';
                        }
                    }}
                    onMouseLeave={e => {
                        if (!active) {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = '#8e8ea0';
                        }
                    }}
                >
                    {children}
                </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} style={{ background: '#000', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, border: '1px solid rgba(255,255,255,0.1)', zIndex: 100000, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontFamily: "'Inter', sans-serif" }}>
                {title}
            </TooltipContent>
        </Tooltip>
    );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
type SidebarTab = 'chat' | 'agents' | 'prompts' | 'files' | 'skills' | 'projects' | 'search' | 'memories' | 'bookmarks';

interface SidebarProps {
    activeTab?: SidebarTab;
    open: boolean;
    onToggle: () => void;
    conversations: Conversation[];
    activeConvId: string | null;
    onSelectConv: (id: string) => void;
    onNewChat: () => void;
    onDeleteConv: (id: string) => void;
    onOpenSettings: () => void;
    onToggleRightPanel: () => void;
    rightPanelOpen: boolean;
    onChangeView?: (view: SidebarTab) => void;
}

export default function Sidebar({
    activeTab = 'chat',
    open,
    onToggle,
    conversations,
    activeConvId,
    onSelectConv,
    onNewChat,
    onDeleteConv,
    onOpenSettings,
    onChangeView,
}: SidebarProps) {
    
    const [search, setSearch] = useState('');
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const footerRef = useRef<HTMLDivElement>(null);

    // Close account menu on outside click
    useEffect(() => {
        if (!accountMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (footerRef.current && !footerRef.current.contains(e.target as Node)) {
                setAccountMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [accountMenuOpen]);

    const filtered = useMemo(() => {
        if (!search.trim()) return conversations;
        return conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
    }, [conversations, search]);

    const grouped = useMemo(() => {
        const groups: Partial<Record<GroupKey, Conversation[]>> = {};
        const order: GroupKey[] = ['Today', 'Yesterday', 'Previous 7 Days', 'Older'];
        for (const conv of filtered) {
            const key = getGroupLabel(conv.updatedAt);
            if (!groups[key]) groups[key] = [];
            groups[key]!.push(conv);
        }
        return order.filter((k) => groups[k]?.length).map((k) => ({ label: k, items: groups[k]! }));
    }, [filtered]);

    const navClick = (tabName: SidebarTab) => () => {
        if (onChangeView) {
            if (activeTab === tabName && open) {
                onToggle(); // collapse
            } else {
                onChangeView(tabName);
                if (!open) onToggle(); // expand
            }
        }
    };

    return (
        <div style={{
            width: open ? 312 : 60,
            minWidth: open ? 312 : 60,
            height: '100vh',
            display: 'flex',
            flexDirection: 'row',
            overflow: 'hidden',
            transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)',
            flexShrink: 0,
            fontFamily: "'Inter', sans-serif",
            background: '#171717',
        }}>
            {/* ── Layer 1: Left Icon Strip ── */}
            <div style={{
                width: 60,
                minWidth: 60,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px 0 16px',
                background: '#171717',
                zIndex: 10,
            }}>
                <NavIconButton title="Toggle sidebar" onClick={onToggle}>
                    <IconSidebarToggle />
                </NavIconButton>
                <div style={{ height: 12 }} />
                <NavIconButton title="New chat" onClick={onNewChat}>
                    <IconNewChat />
                </NavIconButton>
                <div style={{ height: 12 }} />

                <NavIconButton title="Chats" onClick={navClick('chat')} active={activeTab === 'chat'}>
                    <IconChats />
                </NavIconButton>
                <NavIconButton title="Agents" onClick={navClick('agents')} active={activeTab === 'agents'}>
                    <IconAgents />
                </NavIconButton>
                <NavIconButton title="Prompts" onClick={navClick('prompts')} active={activeTab === 'prompts'}>
                    <IconPrompts />
                </NavIconButton>
                <NavIconButton title="Skills" onClick={navClick('skills')} active={activeTab === 'skills'}>
                    <IconSkills />
                </NavIconButton>
                <NavIconButton title="Memories" onClick={navClick('memories')} active={activeTab === 'memories'}>
                    <IconBrain />
                </NavIconButton>
                <NavIconButton title="Bookmarks" onClick={navClick('bookmarks')} active={activeTab === 'bookmarks'}>
                    <IconBookmark />
                </NavIconButton>
                <NavIconButton title="Attachments" onClick={navClick('files')} active={activeTab === 'files'}>
                    <IconPaperclip />
                </NavIconButton>

                <div style={{ flex: 1 }} />

                <div style={{ position: 'relative' }} ref={footerRef}>
                    {/* Account Dropdown */}
                    {accountMenuOpen && (
                        <>
                            <div onClick={() => setAccountMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                            <div style={{
                                position: 'absolute', bottom: '100%', left: '100%', marginLeft: 8,
                                minWidth: 240, background: '#2f2f2f', borderRadius: 10,
                                border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
                                padding: 6, zIndex: 50, marginBottom: -12,
                            }}>
                                <div style={{ padding: '10px 12px', color: '#8e8ea0', fontSize: 12, lineHeight: 1.5 }}>
                                    <div style={{ fontWeight: 600, color: '#ececec', fontSize: 13 }}>Treon Studio</div>
                                    <div>hello@treonstudio.com</div>
                                </div>
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '2px 0' }} />
                                <DropdownItem label="📁 My Files" />
                                <DropdownItem label="✨ Custom Instructions" />
                                <DropdownItem label="⚙️ Settings" onClick={() => { setAccountMenuOpen(false); onOpenSettings(); }} />
                                <DropdownItem label="🗂️ Archive all chats" />
                                <DropdownItem label="❓ Help & FAQ" />
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '2px 0' }} />
                                <DropdownItem label="Sign out" danger onClick={() => setAccountMenuOpen(false)} />
                            </div>
                        </>
                    )}

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                                style={{
                                    width: 36, height: 36, borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontWeight: 700, fontSize: 14, border: 'none',
                                    cursor: 'pointer', transition: 'transform 0.1s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                            >
                                T
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={12} style={{ background: '#000', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, border: '1px solid rgba(255,255,255,0.1)', zIndex: 100000, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontFamily: "'Inter', sans-serif" }}>
                            Account
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* ── Layer 2: Main Content Area ── */}
            <div style={{
                flex: 1,
                minWidth: 252,
                display: 'flex',
                flexDirection: 'column',
                background: '#171717',
                opacity: open ? 1 : 0,
                transition: 'opacity 0.2s',
                pointerEvents: open ? 'auto' : 'none',
                borderLeft: '1px solid rgba(255,255,255,0.06)',
            }}>
                {activeTab === 'chat' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px 12px 0' }}>
                        {/* Search Messages */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', color: '#ececec', fontSize: 13, borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <span style={{ color: '#8e8ea0' }}><IconBookmark /></span>
                            <span>Search messages</span>
                        </div>
                        
                        {/* Agent Marketplace */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', color: '#ececec', fontSize: 13, borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <span style={{ color: '#8e8ea0' }}><IconGrid /></span>
                            <span>Agent Marketplace</span>
                        </div>

                        {/* Projects Section */}
                        <div style={{ marginTop: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', cursor: 'pointer' }}
                                onMouseEnter={e => {
                                    const actionIcons = e.currentTarget.querySelectorAll('.action-icon') as NodeListOf<HTMLElement>;
                                    actionIcons.forEach(el => el.style.opacity = '1');
                                }}
                                onMouseLeave={e => {
                                    const actionIcons = e.currentTarget.querySelectorAll('.action-icon') as NodeListOf<HTMLElement>;
                                    actionIcons.forEach(el => el.style.opacity = '0');
                                }}
                            >
                                <span style={{ color: '#ececec', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    Projects <IconChevronDown />
                                </span>
                                <div style={{ display: 'flex', gap: 12, color: '#8e8ea0' }}>
                                    <span className="action-icon" style={{ opacity: 0, transition: 'opacity 0.2s', cursor: 'pointer' }}><IconFolder /></span>
                                    <span className="action-icon" style={{ opacity: 0, transition: 'opacity 0.2s', cursor: 'pointer' }}><IconPlus /></span>
                                </div>
                            </div>
                        </div>

                        {/* Chats Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, marginTop: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', cursor: 'pointer' }}
                                onMouseEnter={e => {
                                    const actionIcons = e.currentTarget.querySelectorAll('.action-icon') as NodeListOf<HTMLElement>;
                                    actionIcons.forEach(el => el.style.opacity = '1');
                                }}
                                onMouseLeave={e => {
                                    const actionIcons = e.currentTarget.querySelectorAll('.action-icon') as NodeListOf<HTMLElement>;
                                    actionIcons.forEach(el => el.style.opacity = '0');
                                }}
                            >
                                <span style={{ color: '#ececec', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    Chats <IconChevronDown />
                                </span>
                                <div style={{ display: 'flex', gap: 12, color: '#8e8ea0' }}>
                                    <span className="action-icon" style={{ opacity: 0, transition: 'opacity 0.2s', cursor: 'pointer' }}><IconEdit /></span>
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 16px' }}>
                                {conversations.length === 0 && (
                                    <div style={{ textAlign: 'center', color: '#8e8ea0', fontSize: 12, padding: '24px 16px' }}>
                                        No chats yet.
                                    </div>
                                )}
                                {grouped.map(({ label, items }) => (
                                    <div key={label}>
                                        <div style={{
                                            fontSize: 11, fontWeight: 600, color: '#5a5a6b',
                                            padding: '10px 12px 3px', letterSpacing: '0.05em', textTransform: 'uppercase',
                                        }}>
                                            {label}
                                        </div>
                                        {items.map((conv) => (
                                            <ConvItem
                                                key={conv.id}
                                                conv={conv}
                                                isActive={conv.id === activeConvId}
                                                onSelect={() => onSelectConv(conv.id)}
                                                onDelete={() => onDeleteConv(conv.id)}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'agents' && <AgentsSidebar />}
                {activeTab === 'search' && <SearchSidebar />}
                {activeTab === 'skills' && <SkillsSidebar />}
                {activeTab === 'prompts' && <PromptSidebar />}
                {activeTab === 'memories' && <MemoriesSidebar />}
                {activeTab === 'bookmarks' && <BookmarksSidebar />}
                {activeTab === 'files' && <FilesSidebar />}
            </div>
        </div>
    );
}
