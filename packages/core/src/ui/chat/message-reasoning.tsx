'use client'

import { memo, useState } from 'react';
import { AltArrowDownLinear, AltArrowRightLinear, HelpLinear } from 'solar-icon-set';;
import { cn } from '../../lib/utils';

interface MessageReasoningProps {
  reasoning: string;
  isReasoning?: boolean;
  className?: string;
}

export const MessageReasoning = memo(function MessageReasoning({
  reasoning,
  isReasoning = false,
  className,
}: MessageReasoningProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!reasoning.trim()) return null;

  return (
    <div className={cn('my-3 rounded-lg border border-white/10 bg-white/5 overflow-hidden', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isReasoning ? (
            <div className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
          ) : (
            <HelpLinear className="h-3.5 w-3.5" />
          )}
          <span>{isReasoning ? 'Thinking...' : 'Thought process'}</span>
        </div>
        {isOpen ? <AltArrowDownLinear className="h-3.5 w-3.5" /> : <AltArrowRightLinear className="h-3.5 w-3.5" />}
      </button>
      
      {isOpen && (
        <div className="border-t border-white/10 px-3 py-2 bg-black/20">
          <div className="whitespace-pre-wrap text-xs text-zinc-300 leading-relaxed font-mono max-h-60 overflow-y-auto">
            {reasoning}
          </div>
        </div>
      )}
    </div>
  );
});

MessageReasoning.displayName = 'MessageReasoning';