'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@treonstudio/bungas-core/lib/utils';
import { CodeLinear, InfoCircleLinear, PenLinear, PenLinear, StarsMinimalisticLinear, AltArrowDownLinear, RefreshCircleLinear, CloseCircleLinear } from 'solar-icon-set';
import { Check } from 'lucide-react';;;
import { PromptGroup } from './PromptSidebar';

interface PromptEditorProps {
  prompt: PromptGroup | null;
  onUpdate?: (prompt: PromptGroup) => void;
  isSaving?: boolean;
  isError?: boolean;
}

export function PromptEditor({ prompt, onUpdate, isSaving, isError }: PromptEditorProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(prompt?.name || '');
  
  const [command, setCommand] = useState('');
  const [description, setDescription] = useState(prompt?.snippet || '');
  const [content, setContent] = useState('');
  const [isEditingContent, setIsEditingContent] = useState(false);
  
  const nameInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (prompt) {
      setName(prompt.name);
      setDescription(prompt.snippet);
      setContent(prompt.snippet + '\n\n...'); // Dummy content
    }
  }, [prompt]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (isEditingContent && contentInputRef.current) {
      contentInputRef.current.focus();
      // auto resize logic
      contentInputRef.current.style.height = 'auto';
      contentInputRef.current.style.height = contentInputRef.current.scrollHeight + 'px';
    }
  }, [isEditingContent, content]);

  if (!prompt) {
    return (
      <div className="flex h-full w-full items-center justify-center text-text-secondary">
        Select a prompt to view details
      </div>
    );
  }

  const handleNameSave = () => {
    setIsEditingName(false);
    if (onUpdate && prompt) {
      onUpdate({ ...prompt, name });
    }
  };

  const commandCharCount = command.length;
  const COMMANDS_MAX_LENGTH = 16;
  
  const descCharCount = description.length;
  const DESC_MAX_LENGTH = 120;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div className="flex items-center justify-between">
        {/* Category Selector (Mocked) */}
        <button className="focus:ring-offset-ring-offset relative inline-flex h-9 items-center justify-between rounded-xl border border-border-medium bg-transparent px-3 text-sm text-text-primary transition-all duration-200 ease-in-out hover:bg-accent hover:text-accent-foreground focus:ring-ring-primary gap-2 sm:w-fit">
          <div className="flex items-center space-x-2">
            <span>{prompt.category || 'Category'}</span>
          </div>
          <AltArrowDownLinear className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {/* Prompt Name */}
        <div className="group/title relative mr-2 flex h-8 min-w-0 flex-1 items-center">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setName(prompt.name);
                  setIsEditingName(false);
                }
                if (e.key === 'Enter') handleNameSave();
              }}
              onBlur={handleNameSave}
              className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent pl-2 pr-0 text-base font-semibold text-text-primary outline-none focus:border-border-medium focus:outline-none disabled:opacity-60"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="h-8 min-w-0 flex-1 cursor-text truncate pl-2 text-left text-base font-semibold text-text-primary transition-colors hover:text-text-secondary focus:outline-none"
              title={name}
            >
              {name}
            </button>
          )}
          <div className="ml-1.5 flex shrink-0 items-center justify-center">
            {isSaving && (
              <RefreshCircleLinear className="size-4 animate-spin text-text-secondary" aria-label="Saving" />
            )}
            {!isSaving && !isError && prompt && name === prompt.name && !isEditingName && (
              <Check className="size-4 text-green-500 transition-opacity duration-300" aria-label="Saved" />
            )}
            {isError && (
              <CloseCircleLinear className="size-4 text-red-500 transition-opacity duration-300" aria-label="Error" />
            )}
            {!isSaving && !isError && !isEditingName && name !== prompt?.name && (
              <PenLinear className="size-3.5 text-text-secondary opacity-0 transition-opacity group-hover/title:opacity-100" />
            )}
          </div>
        </div>

        {/* Command */}
        <div className="rounded-xl border border-border-medium">
          <label htmlFor="prompt-command" className="block px-4 pt-2 text-sm text-text-secondary md:hidden">
            Command
          </label>
          <div className="relative flex h-10 items-center gap-1 pl-4 pr-2 text-sm text-text-secondary">
            <CodeLinear className="icon-sm shrink-0" aria-hidden="true" />
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                id="prompt-command"
                placeholder=" "
                value={command}
                onChange={(e) => {
                  let val = e.target.value.toLowerCase().replace(/\\s/g, '-').replace(/[^a-z0-9-]/g, '');
                  if (val.length <= COMMANDS_MAX_LENGTH) setCommand(val);
                }}
                className="peer w-full border-none pr-14 bg-transparent outline-none"
              />
              <label
                htmlFor="prompt-command"
                className="pointer-events-none absolute left-0 top-0.5 hidden max-w-[calc(100%-3.5rem)] origin-[0] translate-y-2 scale-100 rounded bg-presentation px-1 text-sm text-text-secondary transition-transform duration-200 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-3 peer-focus:scale-75 peer-focus:text-text-primary peer-[:not(:placeholder-shown)]:-translate-y-3 peer-[:not(:placeholder-shown)]:scale-75 md:block"
              >
                Command
              </label>
            </div>
            <span className="absolute right-2 shrink-0 text-xs text-text-secondary md:text-sm">
              {`${commandCharCount}/${COMMANDS_MAX_LENGTH}`}
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="rounded-xl border border-border-medium">
          <label htmlFor="prompt-description" className="block px-4 pt-2 text-sm text-text-secondary md:hidden">
            Description
          </label>
          <div className="relative flex h-10 items-center gap-1 pl-4 pr-2 text-sm text-text-secondary">
            <InfoCircleLinear className="icon-sm shrink-0" aria-hidden="true" />
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                id="prompt-description"
                placeholder=" "
                value={description}
                onChange={(e) => {
                  if (e.target.value.length <= DESC_MAX_LENGTH) setDescription(e.target.value);
                }}
                className="peer w-full border-none pr-14 bg-transparent outline-none"
              />
              <label
                htmlFor="prompt-description"
                className="pointer-events-none absolute left-0 top-0.5 hidden max-w-[calc(100%-3.5rem)] origin-[0] translate-y-2 scale-100 rounded bg-presentation px-1 text-sm text-text-secondary transition-transform duration-200 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-3 peer-focus:scale-75 peer-focus:text-text-primary peer-[:not(:placeholder-shown)]:-translate-y-3 peer-[:not(:placeholder-shown)]:scale-75 md:block"
              >
                Description
              </label>
            </div>
            <span className="absolute right-2 shrink-0 text-xs text-text-secondary md:text-sm">
              {`${descCharCount}/${DESC_MAX_LENGTH}`}
            </span>
          </div>
        </div>

        {/* Editor */}
        <div className="flex max-h-[85vh] flex-col sm:max-h-[85vh]">
          <div
            className={cn(
              'relative w-full flex-1 overflow-auto rounded-xl border border-border-medium p-3 text-left transition-all duration-200 sm:p-4',
              isEditingContent ? '' : 'cursor-pointer hover:bg-surface-tertiary',
            )}
          >
            <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
              {/* Variables Dropdown Mock */}
              <button className="group flex h-8 items-center gap-1.5 rounded-lg bg-transparent px-2 text-sm border-border-medium bg-surface-secondary text-text-primary hover:bg-surface-tertiary">
                <StarsMinimalisticLinear className="size-3.5 text-text-secondary" aria-hidden="true" />
                <span className="hidden text-xs font-medium sm:inline">Variables</span>
                <AltArrowDownLinear className="size-3 transition-transform duration-200" aria-hidden="true" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsEditingContent((prev) => !prev)}
                className="size-8 p-0 hover:bg-surface-tertiary inline-flex items-center justify-center rounded-md"
              >
                {isEditingContent ? (
                  <Check className="size-4 text-text-secondary" aria-hidden="true" />
                ) : (
                  <PenLinear className="size-4 text-text-secondary" aria-hidden="true" />
                )}
              </button>
            </div>
            
            {!isEditingContent && (
              <button
                type="button"
                className="absolute inset-0 z-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
                onClick={() => setIsEditingContent(true)}
              />
            )}

            {isEditingContent ? (
              <textarea
                ref={contentInputRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full resize-none overflow-y-auto bg-transparent font-mono text-sm leading-relaxed text-text-primary placeholder:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary sm:text-base min-h-[6rem]"
                onBlur={() => setIsEditingContent(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsEditingContent(false);
                  }
                }}
                placeholder="Enter prompt text here..."
              />
            ) : (
              <div
                className="group/preview relative min-h-[6rem] overflow-y-auto text-sm sm:text-base"
                style={{ maxHeight: '24rem' }}
                onClick={() => setIsEditingContent(true)}
              >
                {!content ? (
                  <p className="italic text-text-tertiary">Click to edit</p>
                ) : (
                  <div className="markdown prose dark:prose-invert light w-full break-words text-text-primary whitespace-pre-wrap">
                    {content}
                  </div>
                )}
                <div className="pointer-events-none sticky bottom-1/2 z-10 flex translate-y-1/2 items-center justify-center opacity-0 transition-all duration-200 group-hover/preview:opacity-100">
                  <div className="flex items-center gap-2 rounded-lg border border-border-light bg-surface-primary px-3 py-1.5 shadow-md">
                    <PenLinear className="size-4 text-text-secondary" aria-hidden="true" />
                    <span className="text-sm font-medium text-text-primary">
                      Click to edit
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
