// packages/core/src/ui/chat/message-content.tsx
'use client'

import { memo, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { renderLatex } from '../../utils/latex';
import { parseMarkdown } from '../../utils/markdown';
import { MessageReasoning } from './message-reasoning';
import { LinkLinear } from 'solar-icon-set';;;

// Pre-process math and links before rendering markdown
function processContent(content: string): string {
  // Strip think tags from text content since they are rendered separately
  const thinkRegex = new RegExp('<' + 'think' + '>[\\s\\S]*?<\\/' + 'think' + '>', 'g');
  const cleanContent = content.replace(thinkRegex, '').trim();

  return cleanContent
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) =>
      `<div class="katex-block my-3">${renderLatex(latex.trim(), true)}</div>`
    )
    .replace(/\$([^$\n]+?)\$/g, (_, latex) =>
      `<span class="katex-inline">${renderLatex(latex.trim(), false)}</span>`
    );
}

// Extract thinking content from think blocks
function extractReasoning(content: string): { reasoning: string; isReasoning: boolean } {
  const thinkMatchRegex = new RegExp('<' + 'think' + '>([\\s\\S]*?)(<\\/' + 'think' + '>|$)');
  const thinkMatch = content.match(thinkMatchRegex);
  if (!thinkMatch) return { reasoning: '', isReasoning: false };
  
  const reasoning = thinkMatch[1].trim();
  const isReasoning = !thinkMatch[0].endsWith('</' + 'think' + '>');
  return { reasoning, isReasoning };
}

// Simple citation interface
export interface Citation {
  index: number;
  url: string;
  title: string;
}

export interface MessageContentProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
  truncate?: boolean;
  citations?: Citation[];
}

export const MessageContent = memo(function MessageContent({
  content,
  className,
  isStreaming = false,
  truncate = false,
  citations = [],
}: MessageContentProps) {
  const { reasoning, isReasoning } = useMemo(() => extractReasoning(content), [content]);
  const processedContent = useMemo(() => processContent(content), [content]);

  const MAX_LENGTH = 600;
  const shouldTruncate = truncate && content.length > MAX_LENGTH;
  const displayContent = shouldTruncate
    ? content.slice(0, MAX_LENGTH) + '…'
    : processedContent;

  const htmlContent = useMemo(() => {
    try {
      let parsed = parseMarkdown(displayContent);
      
      // Inject interactive citation link tags in-place of matches like [1] or [^1]
      citations.forEach((cit) => {
        const citationRegex = new RegExp(`\\[\\^?${cit.index}\\]`, 'g');
        parsed = parsed.replace(
          citationRegex,
          `<a href="${cit.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold w-4 h-4 hover:bg-emerald-500/30 transition-colors mx-0.5" title="${cit.title}">${cit.index}</a>`
        );
      });
      return parsed;
    } catch (e) {
      console.error('Markdown parse error:', e);
      return displayContent;
    }
  }, [displayContent, citations]);

  return (
    <div className={cn('relative', className)}>
      {/* Reasoning block */}
      {reasoning && (
        <MessageReasoning reasoning={reasoning} isReasoning={isReasoning || isStreaming} />
      )}

      {/* Main message text */}
      {htmlContent && (
        <div
          className="prose prose-invert max-w-none text-sm leading-relaxed text-zinc-100 [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-word [&_code]:break-all [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )}

      {/* Footnotes Panel */}
      {citations.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Sources</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {citations.map((cit) => (
              <a
                key={cit.index}
                href={cit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left"
              >
                <LinkLinear className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="overflow-hidden">
                  <p className="text-xs font-medium text-zinc-200 truncate">{cit.title}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{cit.url}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {isStreaming && content.length > 0 && !isReasoning && (
        <span
          className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-green-500 align-middle"
          aria-hidden="true"
        />
      )}
    </div>
  );
});