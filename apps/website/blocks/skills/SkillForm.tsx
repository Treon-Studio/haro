'use client';

import React, { useState } from 'react';
import { cn } from '@treonstudio/bungas-core/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DangerTriangleLinear, PenLinear } from 'solar-icon-set';
import { Check } from 'lucide-react';;;

export interface Skill {
  id: string;
  name: string;
  description: string;
  body: string;
  category: string;
}

interface SkillFormProps {
  skill?: Skill;
  onSave?: (skill: Skill) => void;
  onCancel?: () => void;
}

export default function SkillForm({ skill, onSave, onCancel }: SkillFormProps) {
  const [name, setName] = useState(skill?.name || '');
  const [description, setDescription] = useState(skill?.description || '');
  const [body, setBody] = useState(skill?.body || '');
  const [category, setCategory] = useState(skill?.category || '');
  const [isEditingContent, setIsEditingContent] = useState(!skill);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!description.trim()) newErrors.description = 'Description is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate() && onSave) {
      onSave({
        id: skill?.id || Date.now().toString(),
        name,
        description,
        body,
        category,
      });
    }
  };

  const EditorIcon = isEditingContent ? Check : PenLinear;

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full px-4 py-2"
      aria-label={skill ? 'Edit Skill' : 'Create Skill'}
    >
      <h1 className="sr-only">{skill ? 'Edit Skill' : 'Create Skill'}</h1>

      <div className="mb-1 flex flex-col items-center justify-between font-bold sm:text-xl md:mb-0 md:text-2xl">
        <div className="flex w-full flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <div className="relative mb-1 flex w-full flex-col sm:w-auto md:mb-0">
            <Input
              id="skill-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="peer mr-2 w-full border border-border-medium p-2 text-2xl text-text-primary"
              placeholder=" "
              tabIndex={0}
              aria-label="Name"
              aria-required="true"
              aria-invalid={errors.name ? 'true' : 'false'}
              aria-describedby={errors.name ? 'skill-name-error' : undefined}
            />
            <label
              htmlFor="skill-name"
              className="pointer-events-none absolute -top-1 left-3 origin-[0] translate-y-3 scale-100 rounded bg-presentation px-1 text-base text-text-secondary transition-transform duration-200 peer-placeholder-shown:translate-y-3 peer-placeholder-shown:scale-100 peer-focus:-translate-y-2 peer-focus:scale-75 peer-focus:text-text-primary peer-[:not(:placeholder-shown)]:-translate-y-2 peer-[:not(:placeholder-shown)]:scale-75"
            >
              Name*
            </label>
            <div
              id="skill-name-error"
              className={cn(
                'mt-1 w-56 text-sm text-red-500',
                errors.name ? 'visible h-auto' : 'invisible h-0'
              )}
              role={errors.name ? 'alert' : undefined}
            >
              {errors.name ? errors.name : ' '}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex w-full flex-col gap-4">
        <div className="flex flex-col">
          <label
            htmlFor="skill-description"
            className="mb-1 text-sm font-medium text-text-secondary"
          >
            Description
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <Textarea
            id="skill-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            aria-label="Description"
            aria-invalid={errors.description ? 'true' : 'false'}
            aria-describedby={errors.description ? 'skill-description-error' : undefined}
            className="w-full resize-none rounded-xl border border-border-medium bg-transparent p-3 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
          />
          <p className="mt-1 text-xs text-text-secondary">
            A short description of what this skill does.
          </p>
          {errors.description && (
            <p
              id="skill-description-error"
              className="mt-1 text-sm text-red-500"
              role="alert"
            >
              {errors.description}
            </p>
          )}
        </div>

        {/* Skill Content Editor Mock */}
        <div className="flex max-h-[85vh] flex-col sm:max-h-[85vh]">
          <h2 className="sr-only">Content</h2>
          <div
            className={cn(
              'relative w-full flex-1 overflow-auto rounded-xl border border-border-medium p-3 text-left transition-all duration-200 sm:p-4',
              isEditingContent ? '' : 'cursor-pointer hover:bg-surface-tertiary'
            )}
          >
            <div className="absolute right-2 top-2 z-10">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsEditingContent((prev) => !prev)}
                aria-label={isEditingContent ? 'Save' : 'Edit'}
                className="size-8 p-0 hover:bg-surface-tertiary"
              >
                <EditorIcon className="size-4 text-text-secondary" aria-hidden="true" />
              </Button>
            </div>
            {!isEditingContent && (
              <button
                type="button"
                aria-label="Edit"
                className="absolute inset-0 z-10 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
                onClick={() => setIsEditingContent(true)}
              />
            )}
            
            {isEditingContent ? (
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                autoFocus
                className="w-full min-h-[160px] resize-none overflow-y-auto bg-transparent font-mono text-sm leading-relaxed text-text-primary placeholder:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary sm:text-base border-none shadow-none"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsEditingContent(false);
                  }
                }}
                placeholder="Write your skill instructions here..."
                aria-label="Content"
              />
            ) : (
              <div
                className="group/preview relative min-h-[6rem] overflow-y-auto text-sm sm:text-base"
                style={{ maxHeight: '24rem' }}
              >
                {!body ? (
                  <p className="italic text-text-secondary">Click to edit</p>
                ) : (
                  <div className="markdown prose dark:prose-invert light w-full break-words text-text-primary whitespace-pre-wrap">
                    {body}
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

        <div className="mt-4 flex items-center justify-end gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            className="w-full sm:w-auto"
          >
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}
