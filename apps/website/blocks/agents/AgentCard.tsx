'use client';

import React from 'react';
import { cn } from '@treonstudio/bungas-core/lib/utils';
import { Label } from '@treonstudio/bungas-core/ui/label';
import { Agent } from './mockData';

interface AgentCardProps {
  agent: Agent;
  categoryLabel?: string;
  className?: string;
}

const renderAgentAvatar = (agent: Agent) => {
  if (agent.avatarUrl) {
    return (
      <img
        src={agent.avatarUrl}
        alt={agent.name}
        className="h-14 w-14 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-tertiary text-text-primary text-xl font-bold">
      {agent.name.charAt(0).toUpperCase()}
    </div>
  );
};

const AgentCard: React.FC<AgentCardProps> = ({ agent, categoryLabel, className = '' }) => {
  return (
    <a
      href={`/agents/${agent.id}`}
      className={cn(
        'group relative flex h-32 gap-5 overflow-hidden rounded-xl',
        'cursor-pointer select-none px-6 py-4',
        'bg-surface-tertiary transition-colors duration-150 hover:bg-surface-hover',
        'md:h-36 lg:h-40',
        '[&_*]:cursor-pointer',
        className,
      )}
      aria-label={`View ${agent.name}`}
    >
      {/* Category badge - top right */}
      {categoryLabel && (
        <span className="absolute right-4 top-3 rounded-md bg-surface-hover px-2 py-0.5 text-xs text-text-secondary">
          {categoryLabel}
        </span>
      )}

      {/* Avatar */}
      <div className="flex-shrink-0 self-center">
        <div className="overflow-hidden rounded-full shadow-[0_0_15px_rgba(0,0,0,0.3)] dark:shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          {renderAgentAvatar(agent)}
        </div>
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
        {/* Agent name */}
        <Label className="line-clamp-2 text-base font-semibold text-text-primary md:text-lg">
          {agent.name}
        </Label>

        {/* Agent description */}
        {agent.description && (
          <p
            className="mt-0.5 line-clamp-2 text-sm leading-snug text-text-secondary md:line-clamp-5"
          >
            {agent.description}
          </p>
        )}

        {/* Author */}
        {agent.author && (
          <div className="mt-1 text-xs text-text-tertiary">
            <span className="truncate">
              By {agent.author}
            </span>
          </div>
        )}
      </div>
    </a>
  );
};

export default AgentCard;
