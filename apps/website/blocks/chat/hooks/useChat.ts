import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MODELS, type Model, loadApiKey } from '../config/providers';

export type { Model };
export { MODELS };

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Citation {
  index: number;
  url: string;
  title: string;
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string; // base64 for images
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  attachments?: AttachedFile[];
  isStreaming?: boolean;
  error?: boolean;
  citations?: Citation[];
  tool_call_id?: string;
  replyTo?: { id: string; content: string; role: string };
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  provider: string;
  createdAt: Date;
  updatedAt: Date;
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function generateTitle(content: string) {
  return content.length > 40 ? content.slice(0, 40) + '…' : content;
}

const CONVS_KEY = 'tenang:conversations';
const ACTIVE_KEY = 'tenang:activeConvId';

function serializeConvs(convs: Conversation[]): string {
  return JSON.stringify(convs);
}

function deserializeConvs(raw: string): Conversation[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any[] = JSON.parse(raw);
    return parsed.map(c => ({
      ...c,
      createdAt: new Date(c.createdAt as string),
      updatedAt: new Date(c.updatedAt as string),
      messages: (c.messages as Record<string, unknown>[]).map(m => ({
        ...m,
        createdAt: new Date(m.createdAt as string),
      })),
    })) as Conversation[];
  } catch {
    return [];
  }
}

function loadConvs(): Conversation[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(CONVS_KEY);
  return raw ? deserializeConvs(raw) : [];
}

function loadActiveId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_KEY);
}

async function fetchAIResponseFollowup(
  messages: any[],
  model: string,
  provider: string,
  onChunk: (chunk: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const clientApiKey = loadApiKey(provider);
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, provider, apiKey: clientApiKey, webSearch: false }),
    signal,
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => null);
    const errorMsg = errorJson?.error || 'Failed to fetch AI response';
    throw new Error(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
  }

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let done = false;
  let buffer = '';

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') return;
          try {
            const data = JSON.parse(dataStr);
            const contentChunk = data.choices?.[0]?.delta?.content;
            if (contentChunk) onChunk(contentChunk);
          } catch {}
        }
      }
    }
  }
}

async function executeWebSearch(query: string, recencyDays?: number): Promise<string> {
  try {
    // Use DuckDuckGo HTML scraping for free web search (no API key needed)
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) throw new Error('Search failed');

    const data = await response.json();

    // Extract relevant results
    const results: string[] = [];

    if (data.AbstractText) {
      results.push(`Source: ${data.AbstractURL || 'Unknown'}\n${data.AbstractText}`);
    }

    if (data.RelatedTopics?.length > 0) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text) {
          results.push(`- ${topic.Text}${topic.FirstURL ? ` (${topic.FirstURL})` : ''}`);
        }
      }
    }

    // Fallback: construct answer from AnswerType
    if (results.length === 0 && data.AnswerType) {
      results.push(`Answer: ${data.Answer}`);
    }

    return results.length > 0
      ? results.join('\n\n')
      : JSON.stringify({ query, message: 'No results found', recency_days: recencyDays });
  } catch {
    return JSON.stringify({ query, error: 'Web search failed. Please try again.' });
  }
}

async function executeImageGeneration(prompt: string, aspectRatio?: string): Promise<string> {
  const apiKey = typeof window !== 'undefined'
    ? localStorage.getItem('tenang:apiKey') || ''
    : '';
  const openrouterKey = import.meta.env?.OPENROUTER_API_KEY || '';

  const finalKey = openrouterKey || apiKey;
  if (!finalKey) {
    throw new Error('API key not configured for image generation');
  }

  const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${finalKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'blackforest-labs/flux-schnell',
      prompt,
      aspect_ratio: aspectRatio || '1:1',
      steps: 4,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Image generation failed: ${err}`);
  }

  const data = await response.json();
  return JSON.stringify({ imageUrl: data.data?.[0]?.url, revisedPrompt: data.data?.[0]?.revised_prompt });
}

async function fetchAIResponse(
  messages: Message[],
  model: string,
  provider: string,
  onChunk: (chunk: string) => void,
  onToolCall: (toolCallId: string, name: string, args: string) => void,
  onToolDone: () => void,
  webSearch: boolean,
  signal: AbortSignal,
): Promise<void> {
  const clientApiKey = loadApiKey(provider);
  // Build request with optional web search tools and file attachments
  const body: Record<string, any> = { messages, model, provider, apiKey: clientApiKey, webSearch };

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => null);
    const errorMsg = errorJson?.error || 'Failed to fetch AI response';
    throw new Error(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let done = false;
  let buffer = '';

  // Accumulator for tool_calls deltas
  let currentToolCallId = '';
  let currentToolCallName = '';
  let currentToolCallArgs = '';

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') {
            onToolDone();
            return;
          }
          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices?.[0]?.delta;

            // Handle content chunks
            const contentChunk = delta?.content;
            if (contentChunk) {
              onChunk(contentChunk);
            }

            // Handle tool_call deltas (function calling)
            const toolCalls = delta?.tool_calls;
            if (toolCalls && toolCalls.length > 0) {
              for (const tc of toolCalls) {
                if (tc.index !== undefined && tc.index > 0) continue; // only first tool
                if (tc.id) currentToolCallId = tc.id;
                if (tc.function?.name) currentToolCallName = tc.function.name;
                if (tc.function?.arguments) currentToolCallArgs += tc.function.arguments;
              }
            }

            // Handle tool_call done (finish_reason = 'tool_calls')
            const finishReason = data.choices?.[0]?.finish_reason;
            if (finishReason === 'tool_calls' && currentToolCallId && currentToolCallName) {
              onToolCall(currentToolCallId, currentToolCallName, currentToolCallArgs);
              currentToolCallId = '';
              currentToolCallName = '';
              currentToolCallArgs = '';
            }
          } catch (e) {
            // parsing error, ignore
          }
        }
      }
    }
  }
  onToolDone();
}

export function useChat({ initialChatId }: { initialChatId?: string } = {}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(() => {
    return initialChatId || null;
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model>(MODELS[0]);
  const [webSearch, setWebSearch] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const isToolCallRef = useRef(false);
  const toolSearchResultRef = useRef<string>('');
  const activeConvIdRef = useRef(activeConvId);
  const conversationsRef = useRef(conversations);
  const isStreamingRef = useRef(isStreaming);
  const selectedModelRef = useRef(selectedModel);
  const webSearchRef = useRef(webSearch);

  // B2B States
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [authError, setAuthError] = useState<'quota_exceeded' | 'forbidden' | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // 1. Load conversations from localStorage only on client-side mount
    setConversations(loadConvs());

    // 2. Synchronize activeConvId with the current URL path on client-side mount
    const match = window.location.pathname.match(/\/c\/([^/]+)/);
    if (match) {
      setActiveConvId(match[1]);
    }
  }, []);

  useEffect(() => {
    fetch('/api/companies')
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data && result.data.length > 0) {
          const compId = result.data[0].id;
          setCompanyId(compId);
          // Now fetch billing status to check quota
          fetch(`/api/companies/${compId}/billing`)
            .then(bRes => bRes.json())
            .then(bResult => {
              if (bResult.success && bResult.data) {
                setIsQuotaExceeded(bResult.data.is_quota_exceeded);
              }
            }).catch(() => {});
        }
      }).catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      const pathname = window.location.pathname;
      const match = pathname.match(/\/c\/([^/]+)/);
      setActiveConvId(match ? match[1] : null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pathname = window.location.pathname;
    if (activeConvId) {
      const targetPath = `/c/${activeConvId}`;
      if (pathname !== targetPath) {
        window.history.pushState({}, "", targetPath);
      }
    } else {
      if (pathname !== "/c" && pathname !== "/") {
        window.history.pushState({}, "", "/c");
      }
    }
  }, [activeConvId]);

  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);
  useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);
  useEffect(() => { webSearchRef.current = webSearch; }, [webSearch]);

  // Helper: save conversations to KV API (fire-and-forget)
  const saveToAPI = useCallback(async (convs: Conversation[]) => {
    try {
      // Save only the active/updated conversations (up to 5 latest)
      const toSave = convs.slice(0, 5);
      await Promise.all(
        toSave.map((c) =>
          fetch('/api/conversations', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              ...(companyId ? { 'x-company-id': companyId } : {}),
            },
            body: JSON.stringify({ conversation: c }),
            signal: AbortSignal.timeout(5000),
          }).then(async (res) => {
            if (res.status === 403) {
              const err = await res.json().catch(() => null);
              if (err?.error?.includes("kuota") || err?.error?.includes("habis")) {
                setAuthError("quota_exceeded");
              } else if (err?.error?.includes("Forbidden") || err?.error?.includes("member")) {
                setAuthError("forbidden");
              }
            }
          }).catch(() => {}),
        ),
      );
    } catch {
      // API not available — localStorage is the fallback
    }
  }, [companyId]);

  // Helper: load conversations from API, fall back to localStorage
  const loadConversations = useCallback(async (): Promise<Conversation[]> => {
    try {
      const res = await fetch('/api/conversations', {
        headers: companyId ? { 'x-company-id': companyId } : undefined,
        signal: AbortSignal.timeout(3000),
      });
      if (res.status === 403) {
        const err = await res.json().catch(() => null);
        if (err?.error?.includes("kuota") || err?.error?.includes("habis")) {
          setAuthError("quota_exceeded");
        } else if (err?.error?.includes("Forbidden") || err?.error?.includes("member")) {
          setAuthError("forbidden");
        }
      }
      if (!res.ok) throw new Error('API unavailable');
      const data = await res.json();
      if (data.conversations?.length > 0) {
        return data.conversations.map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
          messages: (c.messages || []).map((m: any) => ({
            ...m,
            createdAt: new Date(m.createdAt),
          })),
        }));
      }
    } catch {
      // API not available, fall back to localStorage
    }
    return [];
  }, [companyId]);

  // On mount: conversations are already loaded from localStorage via useState.
  // We intentionally skip the GET /api/conversations here to prevent a loop:
  // GET → setConversations → persist effect → POST to KV → Astro hot-reload → re-mount.
  // Cross-device sync will be handled via periodic polling (future enhancement).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvId) ?? null,
    [conversations, activeConvId]
  );

  // Persist conversations to localStorage + API with debounce & streaming skip
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CONVS_KEY, serializeConvs(conversations));

    if (isStreaming || isSearching) return;

    const timeout = setTimeout(() => {
      saveToAPI(conversations);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [conversations, isStreaming, isSearching, saveToAPI]);

  // Persist active conversation ID
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeConvId) {
      localStorage.setItem(ACTIVE_KEY, activeConvId);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  }, [activeConvId]);

  // On mount: clear stale activeConvId if the conversation was deleted
  useEffect(() => {
    if (activeConvId && !conversations.find(c => c.id === activeConvId)) {
      setActiveConvId(null);
    }
    // intentionally empty deps — mount-only guard
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createNewConversation = useCallback(() => {
    setActiveConvId(null);
  }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveConvId(id);
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setActiveConvId((prev) => (prev === id ? null : prev));
    fetch(`/api/conversations/${id}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (content: string, files?: AttachedFile[], baseMessages?: Message[], replyTo?: { id: string; content: string; role: string }) => {
      if ((!content.trim() && (!files || files.length === 0)) || isStreamingRef.current) return;

      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        createdAt: new Date(),
        attachments: files?.length ? files : undefined,
        replyTo,
      };

      const model = selectedModelRef.current;
      let convId = activeConvIdRef.current;

      // If no active conversation, create one
      if (!convId) {
        const newConv: Conversation = {
          id: generateId(),
          title: generateTitle(content),
          messages: [userMsg],
          model: model.id,
          provider: model.provider,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        convId = newConv.id;
        setConversations((prev) => [newConv, ...prev]);
        setActiveConvId(convId);
      } else if (!baseMessages) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, userMsg], updatedAt: new Date() }
              : c,
          ),
        );
      }

      // Add placeholder assistant message for streaming
      const assistantMsgId = generateId();
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
        isStreaming: true,
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: new Date() }
            : c,
        ),
      );

      setIsStreaming(true);
      abortRef.current = new AbortController();
      isToolCallRef.current = false;
      toolSearchResultRef.current = '';

      const currentConvMessages = baseMessages || [
        ...(conversationsRef.current.find((c) => c.id === convId)?.messages ?? []),
        userMsg,
      ];

      try {
        await fetchAIResponse(
          currentConvMessages,
          model.id,
          model.provider,
          (chunk) => {
            // Skip chunks while a tool call is being executed
            if (isToolCallRef.current) return;
            setConversations((prev) =>
              prev.map((c) =>
                c.id === convId
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, content: m.content + chunk }
                          : m,
                      ),
                    }
                  : c,
              ),
            );
          },
          async (toolCallId, toolName, toolArgs) => {
            isToolCallRef.current = true;
            setIsSearching(true);

            // Show "Searching..." in the message
            setConversations((prev) =>
              prev.map((c) =>
                c.id === convId
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, content: m.content + `\n[Calling ${toolName}...]` }
                          : m,
                      ),
                    }
                  : c,
              ),
            );

            try {
              let toolResult = '';
              const args = JSON.parse(toolArgs || '{}');

              if (toolName === 'web_search') {
                toolResult = await executeWebSearch(args.query, args.recency_days);
              } else if (toolName === 'image_generation') {
                const imageUrl = await executeImageGeneration(args.prompt, args.aspect_ratio);
                toolResult = JSON.stringify({ imageUrl, prompt: args.prompt });
              }

              toolSearchResultRef.current = toolResult;

              // Add tool result as a tool role message
              const toolMsgId = generateId();
              const toolMsg: Message = {
                id: toolMsgId,
                role: 'tool',
                content: toolResult,
                createdAt: new Date(),
              };

              setConversations((prev) =>
                prev.map((c) =>
                  c.id === convId
                    ? { ...c, messages: [...c.messages, toolMsg], updatedAt: new Date() }
                    : c,
                ),
              );

              // Continue with a follow-up request that includes the tool result
              // Clear the placeholder and continue streaming
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === convId
                    ? {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === assistantMsgId
                            ? { ...m, content: '' }
                            : m,
                        ),
                      }
                    : c,
                ),
              );

              // Make follow-up request with tool result
              abortRef.current = new AbortController();
              await fetchAIResponseFollowup(
                [
                  ...currentConvMessages,
                  { role: 'assistant' as const, content: '', tool_calls: [{ id: toolCallId, type: 'function' as const, function: { name: toolName, arguments: toolArgs } }] },
                  { role: 'tool' as const, content: toolResult, tool_call_id: toolCallId },
                ],
                model.id,
                model.provider,
                (chunk) => {
                  setConversations((prev) =>
                    prev.map((c) =>
                      c.id === convId
                        ? {
                            ...c,
                            messages: c.messages.map((m) =>
                              m.id === assistantMsgId
                                ? { ...m, content: m.content + chunk }
                                : m,
                            ),
                          }
                        : c,
                    ),
                  );
                },
                abortRef.current.signal,
              );
            } catch (toolError) {
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === convId
                    ? {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === assistantMsgId
                            ? { ...m, content: m.content + `\n[Tool error: ${String(toolError)}]` }
                            : m,
                        ),
                      }
                    : c,
                ),
              );
            } finally {
              setIsSearching(false);
              isToolCallRef.current = false;
            }
          },
          () => {
            setIsSearching(false);
            isToolCallRef.current = false;
          },
          webSearchRef.current,
          abortRef.current.signal,
        );
      } catch (e: any) {
        const errorMsg = e?.message || e || 'Unknown error';
        if (errorMsg.includes("kuota") || errorMsg.includes("habis")) {
          setAuthError("quota_exceeded");
        } else if (errorMsg.includes("Forbidden") || errorMsg.includes("member")) {
          setAuthError("forbidden");
        }
        const parsed = (() => {
          try { return JSON.parse(errorMsg); } catch { return null; }
        })();
        const displayMsg = parsed?.error?.metadata?.raw || parsed?.error?.message || errorMsg;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, error: true, isStreaming: false, content: displayMsg } : m,
                  ),
                }
              : c,
          ),
        );
      } finally {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, isStreaming: false } : m,
                  ),
                }
              : c,
          ),
        );
        setIsStreaming(false);
        setIsSearching(false);
        isToolCallRef.current = false;
      }
    },
    [],
  );

  const editAndResend = useCallback(
    async (messageId: string, newContent: string) => {
      if (!activeConvIdRef.current || isStreamingRef.current) return;
      
      const conv = conversationsRef.current.find((c) => c.id === activeConvIdRef.current);
      if (!conv) return;

      const msgIndex = conv.messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return;

      const newUserMsg: Message = {
        id: generateId(),
        role: 'user',
        content: newContent.trim(),
        createdAt: new Date(),
      };

      const newMessagesArray = [...conv.messages.slice(0, msgIndex), newUserMsg];

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvIdRef.current
            ? { ...c, messages: newMessagesArray, updatedAt: new Date() }
            : c
        )
      );

      await sendMessage(newContent, undefined, newMessagesArray);
    },
    [sendMessage],
  );

  const retryLastMessage = useCallback(() => {
    if (!activeConvIdRef.current || isStreamingRef.current) return;
    const conv = conversationsRef.current.find(c => c.id === activeConvIdRef.current);
    if (!conv) return;

    // Find last assistant message that errored
    const errorIdx = [...conv.messages].map((m, i) => ({ m, i }))
      .filter(({ m }) => m.role === 'assistant' && m.error)
      .pop()?.i ?? -1;

    if (errorIdx === -1) return;

    // Find the user message just before the errored assistant message
    const userMsg = conv.messages
      .slice(0, errorIdx)
      .filter(m => m.role === 'user')
      .pop();
    if (!userMsg) return;

    // Truncate conversation up to (not including) the errored assistant message
    const trimmedMessages = conv.messages.slice(0, errorIdx);
    setConversations(prev =>
      prev.map(c => c.id === activeConvIdRef.current ? { ...c, messages: trimmedMessages } : c)
    );

    // Re-send the user message
    sendMessage(userMsg.content, userMsg.attachments, trimmedMessages);
  }, [sendMessage]);

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (!activeConvIdRef.current || isStreamingRef.current) return;
      const conv = conversationsRef.current.find((c) => c.id === activeConvIdRef.current);
      if (!conv) return;

      const msgIndex = conv.messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1 || conv.messages[msgIndex].role !== 'assistant') return;

      const userMsg = conv.messages
        .slice(0, msgIndex)
        .filter(m => m.role === 'user')
        .pop();
      if (!userMsg) return;

      const trimmedMessages = conv.messages.slice(0, msgIndex);
      setConversations(prev =>
        prev.map(c => c.id === activeConvIdRef.current ? { ...c, messages: trimmedMessages } : c)
      );

      sendMessage(userMsg.content, userMsg.attachments, trimmedMessages);
    },
    [sendMessage],
  );

  return {
    conversations,
    activeConversation,
    activeConvId,
    isStreaming,
    isSearching,
    selectedModel,
    setSelectedModel,
    selectedProvider: selectedModel.provider,
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
    companyId,
    isQuotaExceeded,
    authError,
    setAuthError,
  };
}
