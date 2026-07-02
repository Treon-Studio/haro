'use client';
import { useState, useCallback, useEffect } from 'react';

export interface Bookmark {
  id: string;
  tag: string;
  count: number;
  color: string;
}

const INITIAL_BOOKMARKS: Bookmark[] = [
  { id: '1', tag: 'Code Review', count: 14, color: '#60a5fa' },
  { id: '2', tag: 'Architecture', count: 7, color: '#a78bfa' },
  { id: '3', tag: 'Research', count: 23, color: '#34d399' },
  { id: '4', tag: 'Personal', count: 5, color: '#fbbf24' },
  { id: '5', tag: 'Deployment', count: 9, color: '#f87171' },
];

const STORAGE_KEY = 'tenang:bookmarks';

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useBookmarks() {
  const [bookmarks, _setBookmarks] = useState<Bookmark[]>(INITIAL_BOOKMARKS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        _setBookmarks(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveAndSet = useCallback((updater: (prev: Bookmark[]) => Bookmark[]) => {
    _setBookmarks(prev => {
      const next = updater(prev);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const addBookmark = useCallback((tag: string, color: string) => {
    saveAndSet(prev => [...prev, { id: generateId(), tag: tag.trim(), count: 0, color }]);
  }, [saveAndSet]);

  const deleteBookmark = useCallback((id: string) => {
    saveAndSet(prev => prev.filter(b => b.id !== id));
  }, [saveAndSet]);

  return { bookmarks, addBookmark, deleteBookmark };
}
