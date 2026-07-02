'use client';
import { useState, useCallback, useMemo, useEffect } from 'react';

export interface Memory {
  id: string;
  key: string;
  value: string;
  tokens: number;
  updatedAt: Date;
}

const INITIAL_MEMORIES: Memory[] = [
  { id: '1', key: 'Preferred language', value: 'Indonesian', tokens: 8, updatedAt: new Date('2026-06-18') },
  { id: '2', key: 'Response style', value: 'Concise and direct', tokens: 12, updatedAt: new Date('2026-06-17') },
  { id: '3', key: 'Current project', value: 'Haro — LibreChat parity UI', tokens: 20, updatedAt: new Date('2026-06-16') },
  { id: '4', key: 'Code review preference', value: 'Always explain why, not just what', tokens: 22, updatedAt: new Date('2026-06-15') },
  { id: '5', key: 'Time zone', value: 'Asia/Jakarta (UTC+7)', tokens: 14, updatedAt: new Date('2026-06-14') },
];

const TOKEN_LIMIT = 2048;
const STORAGE_KEY = 'tenang:memories';

function loadMemories(): Memory[] {
  if (typeof window === 'undefined') return INITIAL_MEMORIES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_MEMORIES;
    return (JSON.parse(raw) as Record<string, unknown>[]).map(m => ({
      ...(m as Memory),
      updatedAt: new Date(m.updatedAt as string),
    }));
  } catch {
    return INITIAL_MEMORIES;
  }
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useMemories() {
  const [memories, _setMemories] = useState<Memory[]>(INITIAL_MEMORIES);

  useEffect(() => {
    _setMemories(loadMemories());
  }, []);

  const saveAndSet = useCallback((updater: (prev: Memory[]) => Memory[]) => {
    _setMemories(prev => {
      const next = updater(prev);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const addMemory = useCallback((key: string, value: string) => {
    saveAndSet(prev => [...prev, {
      id: generateId(),
      key: key.trim(),
      value: value.trim(),
      tokens: estimateTokens(value),
      updatedAt: new Date(),
    }]);
  }, [saveAndSet]);

  const deleteMemory = useCallback((id: string) => {
    saveAndSet(prev => prev.filter(m => m.id !== id));
  }, [saveAndSet]);

  const totalTokens = useMemo(() => memories.reduce((sum, m) => sum + m.tokens, 0), [memories]);

  return { memories, addMemory, deleteMemory, totalTokens, tokenLimit: TOKEN_LIMIT };
}
