'use client';

import React, { useState, useEffect } from 'react';
import { PromptEditor } from './PromptEditor';
import { cn } from '@treonstudio/bungas-core/lib/utils';
import { usePrompts } from './usePrompts';

export function InlinePromptsView({ className }: { className?: string }) {
  const { prompts, updatePrompt } = usePrompts();
  const [activePromptId, setActivePromptId] = useState<string | undefined>();
  
  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length > 2) {
      setActivePromptId(pathParts[2]);
    }
  }, []);

  const activePrompt = prompts.find(p => p.id === activePromptId) || null;

  const handleUpdatePrompt = (updated: any) => {
    updatePrompt(updated);
  };

  return (
    <div className={cn("flex h-full w-full overflow-hidden bg-surface-primary", className)}>
      {/* Editor */}
      <div className="flex-1 min-w-0 bg-surface-primary">
        {activePrompt ? (
          <PromptEditor 
            prompt={activePrompt}
            onUpdate={handleUpdatePrompt}
            isSaving={false}
            isError={false}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-text-secondary">
            <p className="font-medium text-text-primary">No prompt selected</p>
            <p className="mt-2 text-sm">Select a prompt from the list to view or edit it.</p>
          </div>
        )}
      </div>
    </div>
  );
}
