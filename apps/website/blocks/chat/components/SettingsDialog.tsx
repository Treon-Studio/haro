'use client';
import React, { useState, useEffect } from 'react';

type Tab = 'general' | 'display' | 'voice' | 'beta' | 'data';

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
        background: value ? '#10a37f' : '#404040',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: value ? 20 : 2,
        width: 18, height: 18, borderRadius: '50%', background: 'white',
        transition: 'left 0.2s', display: 'block',
      }} />
    </button>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: '#ececec', fontWeight: 500 }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: '#8e8ea0', marginTop: 2 }}>{description}</div>}
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: '#5a5a6b', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '16px 0 8px' }}>{children}</div>;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'display', label: 'Display' },
  { id: 'voice', label: 'Voice' },
  { id: 'beta', label: 'Beta Features' },
  { id: 'data', label: 'Data Controls' },
];

export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('general');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [fontSize, setFontSize] = useState(14);
  const [enterSend, setEnterSend] = useState(true);
  const [lineNumbers, setLineNumbers] = useState(true);
  const [showModel, setShowModel] = useState(true);
  const [timestamps, setTimestamps] = useState(false);
  const [compact, setCompact] = useState(false);
  const [sttEnabled, setSttEnabled] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [artifacts, setArtifacts] = useState(true);
  const [memory, setMemory] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [codeInterp, setCodeInterp] = useState(false);
  const [improveModel, setImproveModel] = useState(true);
  // Persist display settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tenang:display', JSON.stringify({ timestamps, compact, showModel, fontSize }));
    } catch { /* ignore quota errors */ }
  }, [timestamps, compact, showModel, fontSize]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 700, maxHeight: 560, background: '#212121', borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.1)', display: 'flex', overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)', fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Left tab sidebar */}
        <div style={{ width: 180, background: '#171717', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', padding: '16px 8px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#ececec', padding: '0 8px 12px' }}>Settings</div>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7,
                border: 'none', fontSize: 13, cursor: 'pointer', transition: 'background 0.1s',
                background: tab === t.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: tab === t.id ? '#ececec' : '#8e8ea0',
                fontFamily: "'Inter', sans-serif",
              }}
              onMouseEnter={e => { if (tab !== t.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (tab !== t.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {t.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7, border: 'none', fontSize: 13, cursor: 'pointer', color: '#ff6b6b', background: 'transparent', fontFamily: "'Inter', sans-serif" }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,107,107,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >Delete account</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#ececec', flex: 1 }}>
              {TABS.find(t => t.id === tab)?.label}
            </span>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', color: '#8e8ea0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#ececec'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
            >×</button>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
            {tab === 'general' && (
              <>
                <SectionLabel>Theme</SectionLabel>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {(['system', 'light', 'dark'] as const).map(t => (
                    <button key={t} onClick={() => setTheme(t)} style={{
                      padding: '6px 14px', borderRadius: 8, border: '1px solid',
                      borderColor: theme === t ? '#10a37f' : 'rgba(255,255,255,0.1)',
                      background: theme === t ? 'rgba(16,163,127,0.12)' : 'transparent',
                      color: theme === t ? '#10a37f' : '#8e8ea0',
                      fontSize: 12, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize', fontFamily: "'Inter', sans-serif",
                    }}>{t}</button>
                  ))}
                </div>
                <SectionLabel>Preferences</SectionLabel>
                <SettingRow label="Send message on Enter" description="Press Shift+Enter for a new line"><Toggle value={enterSend} onChange={setEnterSend} /></SettingRow>
                <SettingRow label="Show code line numbers"><Toggle value={lineNumbers} onChange={setLineNumbers} /></SettingRow>
                <SectionLabel>Language</SectionLabel>
                <select style={{ width: '100%', background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#ececec', fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                  <option>English</option><option>Indonesian</option><option>Spanish</option><option>French</option><option>Japanese</option>
                </select>
                <SectionLabel>Font Size</SectionLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min={12} max={20} value={fontSize} onChange={e => setFontSize(+e.target.value)} style={{ flex: 1, accentColor: '#10a37f' }} />
                  <span style={{ color: '#ececec', fontSize: 13, minWidth: 28 }}>{fontSize}px</span>
                </div>
                <SectionLabel>Conversation Management</SectionLabel>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,80,80,0.3)', background: 'transparent', color: '#ff8080', fontSize: 12, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Clear all conversations</button>
                  <button style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#8e8ea0', fontSize: 12, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Archive all</button>
                </div>
              </>
            )}
            {tab === 'display' && (
              <>
                <SectionLabel>Interface</SectionLabel>
                <SettingRow label="Show model name in header"><Toggle value={showModel} onChange={setShowModel} /></SettingRow>
                <SettingRow label="Show timestamps on messages"><Toggle value={timestamps} onChange={setTimestamps} /></SettingRow>
                <SettingRow label="Compact message spacing"><Toggle value={compact} onChange={setCompact} /></SettingRow>
                <SectionLabel>Conversation Width</SectionLabel>
                <select style={{ width: '100%', background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#ececec', fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                  <option>Standard (720px)</option><option>Wide (900px)</option><option>Full width</option>
                </select>
              </>
            )}
            {tab === 'voice' && (
              <>
                <SectionLabel>Speech-to-Text</SectionLabel>
                <SettingRow label="Enable speech-to-text" description="Use your microphone to send messages"><Toggle value={sttEnabled} onChange={setSttEnabled} /></SettingRow>
                <SettingRow label="Auto-send on silence" description="Automatically send after 2s of silence"><Toggle value={autoSend} onChange={setAutoSend} /></SettingRow>
                <SectionLabel>Voice</SectionLabel>
                <select style={{ width: '100%', background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#ececec', fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                  <option>Alloy</option><option>Echo</option><option>Fable</option><option>Nova</option><option>Shimmer</option>
                </select>
              </>
            )}
            {tab === 'beta' && (
              <>
                <SectionLabel>Experimental Features</SectionLabel>
                <SettingRow label="Artifacts" description="Generate interactive code and diagrams"><Toggle value={artifacts} onChange={setArtifacts} /></SettingRow>
                <SettingRow label="Memory" description="Remember things across conversations"><Toggle value={memory} onChange={setMemory} /></SettingRow>
                <SettingRow label="Web Search" description="Search the web for real-time information"><Toggle value={webSearch} onChange={setWebSearch} /></SettingRow>
                <SettingRow label="Code Interpreter" description="Run code in a sandboxed environment"><Toggle value={codeInterp} onChange={setCodeInterp} /></SettingRow>
              </>
            )}
            {tab === 'data' && (
              <>
                <SectionLabel>Privacy</SectionLabel>
                <SettingRow label="Improve model for everyone" description="Your conversations may be used to improve AI models"><Toggle value={improveModel} onChange={setImproveModel} /></SettingRow>
                <SectionLabel>Export & Delete</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <button style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#ececec', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter', sans-serif" }}>Export all conversations</button>
                  <button style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,80,80,0.3)', background: 'transparent', color: '#ff8080', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter', sans-serif" }}>Delete all conversations</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
