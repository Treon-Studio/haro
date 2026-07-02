// packages/core/src/ui/chat/message-bubble.tsx
'use client'

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  children: ReactNode;
  role?: 'user' | 'assistant' | 'system';
  className?: string;
}

export function MessageBubble({ children, role = 'assistant', className }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 py-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
        className
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-emerald-700 text-white"
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 41 41" fill="none">
            <path
              d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-6.239-3.4 10.079 10.079 0 0 0-10.692 4.958 9.964 9.964 0 0 0-6.65 3.484 10.079 10.079 0 0 0-2.566 11.038 9.964 9.964 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 6.243 3.4 10.078 10.078 0 0 0 10.693-4.559 9.965 9.965 0 0 0 6.65-3.485 10.079 10.079 0 0 0 2.561-11.037zM18z"
              fill="white"
            />
          </svg>
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-md bg-emerald-600 text-white'
            : 'rounded-bl-md bg-zinc-800 text-zinc-100 border border-white/10'
        )}
      >
        {children}
      </div>
    </div>
  );
}