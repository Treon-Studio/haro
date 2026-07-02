'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useChat, type AttachedFile, type Message } from './hooks/useChat';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Landing from './components/Landing';
import MessagesView from './components/MessagesView';
import ChatForm from './components/ChatForm';
import RightPanel from './components/RightPanel';
import SettingsDialog from './components/SettingsDialog';
import AuthErrorDialog from './components/AuthErrorDialog';
import { cn } from '@treonstudio/bungas-core/lib/utils';

import ProjectsView from '../projects/index';
import PromptsView from '../prompts/index';
import SkillsView from '../skills/index';

import {
  DangerTriangleOutline,
  HandHeartOutline,
  CloseCircleOutline,
  SmileCircleOutline,
  SadCircleOutline,
  ExpressionlessCircleOutline,
  EmojiFunnyCircleOutline,
  CheckCircleOutline,
  ClockCircleOutline,
  ArrowRightOutline
} from 'solar-icon-set';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@treonstudio/bungas-core/ui/card';
import { Button } from '@/components/ui/button';

export type AppView = 'chat' | 'agents' | 'projects' | 'prompts' | 'skills' | 'search' | 'memories' | 'bookmarks' | 'files';

const FULL_PAGE_VIEWS = new Set<AppView>(['projects', 'prompts', 'skills']);

export function ChatBlock({ chatId, view = 'chat' }: { chatId?: string; view?: AppView }) {
    const [activePanel, setActivePanel] = useState<AppView>(() => {
        if (typeof window === 'undefined') return view;
        return (localStorage.getItem('side:active-panel') as AppView | null) ?? view;
    });
    const mainView: AppView = FULL_PAGE_VIEWS.has(activePanel) ? activePanel : 'chat';
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [rightPanelOpen, setRightPanelOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const {
        conversations,
        activeConversation,
        activeConvId,
        isStreaming,
        selectedModel,
        setSelectedModel,
        webSearch,
        setWebSearch,
        sendMessage,
        stopStreaming,
        createNewConversation,
        selectConversation,
        deleteConversation,
        editAndResend,
        retryLastMessage,
        regenerateMessage,
        isQuotaExceeded,
        authError,
        setAuthError,
    } = useChat({ initialChatId: chatId });

    const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; role: string } | null>(null);

    const messages = activeConversation?.messages ?? [];
    const isLanding = messages.length === 0;

    const handleNewChat = useCallback(() => {
      // Clear timeout states on new chat
      setMinutesElapsed(0);
      setWarningDismissed(false);
      setSessionSummaryOpen(false);
      createNewConversation();
    }, [createNewConversation]);

    const handleSelectConversation = useCallback((id: string) => {
      // Clear timeout and summary states when switching conversations
      setMinutesElapsed(0);
      setWarningDismissed(false);
      setSessionSummaryOpen(false);
      selectConversation(id);
    }, [selectConversation]);

    const handleRetry = useCallback(() => retryLastMessage(), [retryLastMessage]);

    const handleReply = useCallback((message: { id: string; content: string; role: string }) => {
        setReplyingTo({ id: message.id, content: message.content, role: message.role });
    }, []);

    const handleSendWithReply = useCallback((text: string, files?: AttachedFile[]) => {
        sendMessage(text, files, undefined, replyingTo ?? undefined);
        setReplyingTo(null);
    }, [sendMessage, replyingTo]);

    const handleCancelReply = useCallback(() => setReplyingTo(null), []);

    const handleRegenerate = useCallback((messageId: string) => {
        regenerateMessage(messageId);
    }, [regenerateMessage]);

    const handleShare = useCallback(() => {
        if (!activeConversation) return;
        const shareData = {
            title: activeConversation.title,
            messages: activeConversation.messages.map(m => ({
                role: m.role,
                content: m.content.slice(0, 500),
            })),
        };
        const url = `${window.location.origin}/c/${activeConvId}`;
        const text = `${activeConversation.title}\n\n${shareData.messages.map(m => `[${m.role}] ${m.content}`).join('\n\n')}`;
        if (navigator.share) {
            navigator.share({ title: activeConversation.title, text, url }).catch(() => {});
        } else {
            navigator.clipboard.writeText(url).catch(() => {});
        }
    }, [activeConversation, activeConvId]);

    const handleViewChange = useCallback((newView: AppView) => {
        setActivePanel(newView);
        localStorage.setItem('side:active-panel', newView);
        const path = FULL_PAGE_VIEWS.has(newView)
            ? `/${newView}`
            : newView === 'chat' ? '/c' : window.location.pathname;
        window.history.pushState({}, '', path);
    }, []);

    // ── B2B Safety & Clinical states ──
    const [minutesElapsed, setMinutesElapsed] = useState(0);
    const [warningDismissed, setWarningDismissed] = useState(false);
    const [sessionSummaryOpen, setSessionSummaryOpen] = useState(false);
    const [isCrisisCardDismissed, setIsCrisisCardDismissed] = useState(false);
    const [selectedMood, setSelectedMood] = useState<number | null>(null);

    // Track active conversation age (CHAT-9)
    useEffect(() => {
      if (!activeConversation || isLanding) {
        setMinutesElapsed(0);
        return;
      }

      const checkTime = () => {
        const start = new Date(activeConversation.createdAt).getTime();
        const diffMinutes = Math.floor((Date.now() - start) / (1000 * 60));
        setMinutesElapsed(diffMinutes);

        // Auto-end session at 90 minutes
        if (diffMinutes >= 90 && !sessionSummaryOpen) {
          setSessionSummaryOpen(true);
        }
      };

      checkTime();
      const interval = setInterval(checkTime, 10000); // Check every 10s
      return () => clearInterval(interval);
    }, [activeConversation, isLanding, sessionSummaryOpen]);

    // Reactively detect safety risk keywords (CHAT-16)
    const hasRiskFlag = useMemo(() => {
      const riskKeywords = ['bunuh diri', 'suicide', 'sakiti diri', 'ingin mati', 'akhiri hidup', 'sayat', 'gantung diri'];
      return messages.some(
        (m) => m.role === 'user' && riskKeywords.some((k) => m.content.toLowerCase().includes(k))
      );
    }, [messages]);

    // Context-aware summary generator (CHAT-14)
    const clinicalSummary = useMemo(() => {
      if (messages.length === 0) return '';
      const userText = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join(' ')
        .toLowerCase();

      if (userText.includes('stres') || userText.includes('stres') || userText.includes('lelah') || userText.includes('penat')) {
        return 'Hari ini kita membahas tingkat kelelahan mental (burnout) dan stres pekerjaan yang sedang Anda rasakan. Kami merekomendasikan teknik pernapasan kotak (box breathing) untuk membantu menenangkan pikiran Anda.';
      } else if (userText.includes('sedih') || userText.includes('kecewa') || userText.includes('nangis')) {
        return 'Sesi hari ini berfokus mengeksplorasi rasa sedih dan kecewa mendalam yang sedang Anda alami. Ingatlah untuk bersikap lembut pada diri sendiri; memproses emosi adalah bagian dari penyembuhan.';
      } else if (userText.includes('cemas') || userText.includes('panik') || userText.includes('takut')) {
        return 'Kita mengidentifikasi kecemasan dan ketakutan yang mengganggu ketenangan Anda. Kami menganjurkan latihan "grounding 5-4-3-2-1" untuk meredakan gejolak fisik kecemasan tersebut.';
      } else {
        return 'Sesi hari ini berfokus pada penelusuran emosi, refleksi kesejahteraan emosional, dan penemuan ruang tenang di dalam pikiran Anda. Lanjutkan eksplorasi jurnal harian ini secara konsisten.';
      }
    }, [messages]);

    return (
        <div style={{
            display: 'flex',
            width: '100%',
            height: '100vh',
            background: '#212121',
            color: '#ececec',
            overflow: 'hidden',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: 14,
        }}>
            {/* ── Left Sidebar ── */}
            <Sidebar
                activeTab={activePanel}
                onChangeView={handleViewChange}
                open={sidebarOpen}
                onToggle={() => setSidebarOpen(!sidebarOpen)}
                conversations={conversations}
                activeConvId={activeConvId}
                onSelectConv={handleSelectConversation}
                onNewChat={handleNewChat}
                onDeleteConv={deleteConversation}
                onOpenSettings={() => setSettingsOpen(true)}
                onToggleRightPanel={() => setRightPanelOpen((p) => !p)}
                rightPanelOpen={rightPanelOpen}
            />

            {/* ── Main Area ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', minWidth: 0, position: 'relative' }}>

                {/* Sidebar reopen button when closed and not in chat */}
                {!sidebarOpen && mainView !== 'chat' && (
                    <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 50 }}>
                        <button
                            title="Toggle sidebar"
                            onClick={() => setSidebarOpen(true)}
                            style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: 'none', background: 'transparent', color: '#8e8ea0', cursor: 'pointer' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
                            </svg>
                        </button>
                    </div>
                )}

                {mainView === 'chat' && (
                    <>
                        {/* Header */}
                        <Header
                            sidebarOpen={sidebarOpen}
                            onToggleSidebar={() => setSidebarOpen(true)}
                            onNewChat={handleNewChat}
                            selectedModel={selectedModel}
                            onModelChange={setSelectedModel}
                            hasMessages={!isLanding}
                            onShare={handleShare}
                            onEndSession={() => setSessionSummaryOpen(true)}
                            sessionSummaryOpen={sessionSummaryOpen}
                        />

                        {isLanding ? (
                            /* ── LANDING: center content, form at bottom ── */
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                                {(() => {
                                    const daysAbsent = conversations.length === 0 ? 0 : Math.floor((Date.now() - new Date(conversations[0].updatedAt).getTime()) / (1000 * 60 * 60 * 24));
                                    return (
                                        <Landing
                                            onPromptSelect={(text) => sendMessage(text)}
                                            sessionCount={conversations.length}
                                            daysAbsent={daysAbsent}
                                        />
                                    );
                                })()}
                                {/* Landing: form centered di bawah */}
                                <div style={{ width: '100%', maxWidth: 720, padding: '0 24px 48px', boxSizing: 'border-box' }}>
                                    <ChatForm
                                        onSend={handleSendWithReply}
                                        onStop={stopStreaming}
                                        isStreaming={isStreaming}
                                        webSearch={webSearch}
                                        onWebSearchChange={setWebSearch}
                                        isLanding={true}
                                        replyingTo={replyingTo}
                                        onCancelReply={handleCancelReply}
                                        isQuotaExceeded={isQuotaExceeded}
                                    />
                                </div>
                            </div>
                        ) : sessionSummaryOpen ? (
                            /* ── POST SESSION SUMMARY & MOOD CHECKIN ── */
                            <div className="flex-1 flex items-center justify-center p-6 bg-surface-secondary/10 overflow-y-auto">
                              <Card className="w-full max-w-lg bg-surface-primary border-border-primary text-text-primary shadow-2xl">
                                <CardHeader className="space-y-2 border-b border-border-primary pb-5">
                                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <CheckCircleOutline className="h-5 w-5 text-brand-primary" />
                                    Ringkasan Sesi Konsultasi
                                  </CardTitle>
                                  <CardDescription className="text-text-secondary text-xs">Sesi Anda telah berakhir secara aman. Tinjau rangkuman klinis dari bot Anda di bawah ini.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                  {/* AI Summary block */}
                                  <div className="space-y-1.5">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-text-secondary">Summary Refleksi Anda</h4>
                                    <p className="p-4 rounded-xl bg-surface-secondary/30 border border-border-primary text-sm leading-relaxed italic text-text-secondary">
                                      "{clinicalSummary}"
                                    </p>
                                  </div>

                                  {/* Mood scale checkin */}
                                  <div className="space-y-3 pt-2">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-text-secondary">Bagaimana suasana perasaan Anda saat ini?</h4>
                                    <div className="flex justify-around items-center gap-2 py-2">
                                      {[
                                        { val: 1, icon: SadCircleOutline, label: 'Sangat Buruk', color: 'text-red-500' },
                                        { val: 2, icon: ExpressionlessCircleOutline, label: 'Cukup Buruk', color: 'text-orange-400' },
                                        { val: 3, icon: SmileCircleOutline, label: 'Biasa Saja', color: 'text-amber-500' },
                                        { val: 4, icon: SmileCircleOutline, label: 'Baik', color: 'text-lime-500' },
                                        { val: 5, icon: EmojiFunnyCircleOutline, label: 'Sangat Baik', color: 'text-green-500' }
                                      ].map((m) => {
                                        const Icon = m.icon;
                                        const isSelected = selectedMood === m.val;

                                        return (
                                          <button
                                            key={m.val}
                                            onClick={() => setSelectedMood(m.val)}
                                            className={cn(
                                              "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border bg-transparent cursor-pointer transition-all shrink-0",
                                              isSelected
                                                ? "border-brand-primary bg-brand-primary/10 shadow-sm"
                                                : "border-border-primary hover:bg-surface-secondary hover:border-text-secondary"
                                            )}
                                          >
                                            <Icon className={cn("h-6 w-6", isSelected ? m.color : "text-text-secondary")} />
                                            <span className="text-[10px] text-text-secondary">{m.label}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </CardContent>
                                <CardFooter className="border-t border-border-primary p-4 flex gap-2">
                                  <Button
                                    onClick={handleNewChat}
                                    className="w-full bg-brand-primary text-white hover:bg-brand-secondary h-10 font-bold text-xs"
                                  >
                                    Simpan & Selesaikan Sesi
                                  </Button>
                                </CardFooter>
                              </Card>
                            </div>
                        ) : (
                            /* ── CHAT: messages scroll + form pinned bottom ── */
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                                <MessagesView
                                    messages={messages}
                                    onRetry={handleRetry}
                                    onEditAndResend={editAndResend}
                                    onReply={handleReply}
                                    onRegenerate={handleRegenerate}
                                />
                                {/* Chat: form pinned bottom */}
                                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 24px 24px' }}>
                                  
                                  {/* ── B2B Safety & Clinical Cards (CHAT-9, CHAT-16) ── */}
                                  <div className="w-full max-w-[720px] space-y-2 mb-2">
                                    {/* 1. Session timeout soft-warning (CHAT-9) */}
                                    {minutesElapsed >= 75 && minutesElapsed < 90 && !warningDismissed && (
                                      <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs leading-relaxed text-amber-500">
                                        <div className="flex items-start gap-2">
                                          <ClockCircleOutline className="h-4.5 w-4.5 shrink-0 mt-0.5 animate-pulse" />
                                          <div>
                                            <span className="font-bold block">Sesi Hampir Selesai</span>
                                            Waktu konsultasi kita tersisa sekitar 15 menit lagi. Apakah ada hal penting lain yang ingin kita selesaikan hari ini?
                                          </div>
                                        </div>
                                        <button onClick={() => setWarningDismissed(true)} className="p-1 hover:bg-amber-500/10 rounded-full border-none bg-transparent text-amber-500 cursor-pointer">
                                          <CloseCircleOutline className="h-4 w-4" />
                                        </button>
                                      </div>
                                    )}

                                    {/* 2. Crisis resource card banner (CHAT-16) */}
                                    {hasRiskFlag && !isCrisisCardDismissed && (
                                      <div className="flex items-start justify-between gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs leading-relaxed text-red-500">
                                        <div className="flex items-start gap-2.5">
                                          <HandHeartOutline className="h-5 w-5 shrink-0 mt-0.5 animate-bounce" />
                                          <div>
                                            <span className="font-bold block">Butuh bantuan darurat atau teman bicara langsung?</span>
                                            Kami di sini untuk mendengar, namun jika Anda sedang berada dalam krisis mendesak atau butuh penanganan langsung, silakan hubungi <strong className="text-text-primary font-bold">Into The Light Indonesia: 119 ext. 8</strong> atau kunjungi hotline darurat terdekat. Sesi chat Anda tetap dapat dilanjutkan secara privat.
                                          </div>
                                        </div>
                                        <button onClick={() => setIsCrisisCardDismissed(true)} className="p-1 hover:bg-red-500/10 rounded-full border-none bg-transparent text-red-500 cursor-pointer">
                                          <CloseCircleOutline className="h-4 w-4" />
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ width: '100%', maxWidth: 720 }}>
                                    <ChatForm
                                        onSend={handleSendWithReply}
                                        onStop={stopStreaming}
                                        isStreaming={isStreaming}
                                        webSearch={webSearch}
                                        onWebSearchChange={setWebSearch}
                                        isLanding={false}
                                        replyingTo={replyingTo}
                                        onCancelReply={handleCancelReply}
                                        isQuotaExceeded={isQuotaExceeded}
                                    />
                                  </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {mainView === 'projects' && <ProjectsView />}
                {mainView === 'prompts' && <PromptsView />}
                {mainView === 'skills' && <SkillsView />}
            </div>

            <RightPanel open={rightPanelOpen} onClose={() => setRightPanelOpen(false)} />
            <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <AuthErrorDialog errorType={authError} onClose={() => setAuthError(null)} />
        </div>
    );
}
