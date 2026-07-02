import { useState, useEffect } from 'react';
import { PromptGroup } from './PromptSidebar';

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(l => l());
}

let globalPrompts: PromptGroup[] = [];

export function usePrompts() {
  const [prompts, setPrompts] = useState<PromptGroup[]>(globalPrompts);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleUpdate = () => setPrompts([...globalPrompts]);
    listeners.add(handleUpdate);
    
    // Fetch initial prompts if empty
    if (globalPrompts.length === 0) {
      fetchPrompts();
    }
    
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const fetchPrompts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/prompts');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        globalPrompts = data.data.map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          snippet: item.snippet,
          authorName: item.authorName,
          isPublic: item.isPublic,
        }));
        notify();
      }
    } catch (err) {
      console.error('Failed to fetch prompts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const addPrompt = async (prompt: Omit<PromptGroup, 'id'>) => {
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prompt),
      });
      const data = await res.json();
      
      if (data.success) {
        const newPrompt = {
          id: data.data.id,
          name: data.data.name,
          category: data.data.category,
          snippet: data.data.snippet,
          authorName: data.data.authorName,
          isPublic: data.data.isPublic,
        };
        globalPrompts.push(newPrompt);
        notify();
        return newPrompt;
      } else {
        throw new Error(data.error?.message || 'Failed to create prompt');
      }
    } catch (err) {
      console.error('Failed to add prompt:', err);
      throw err;
    }
  };

  const updatePrompt = (prompt: PromptGroup) => {
    console.warn('API for updatePrompt is not yet fully implemented on backend');
    const index = globalPrompts.findIndex(p => p.id === prompt.id);
    if (index !== -1) {
      globalPrompts[index] = prompt;
      notify();
    }
  };

  return { prompts, isLoading, addPrompt, updatePrompt };
}
