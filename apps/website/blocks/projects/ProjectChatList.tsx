'use client'

import { memo } from 'react'
import { ChatSquareLinear } from 'solar-icon-set';
import { cn } from '@treonstudio/bungas-core/lib/utils'

export type TConversation = {
  conversationId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectChatListProps {
  conversations: TConversation[];
  activeConversationId?: string;
  onSelectConversation: (convo: TConversation) => void;
  emptyLabel?: string;
}

const ConversationRow = memo(
  ({ 
    conversation, 
    isActive,
    onClick 
  }: { 
    conversation: TConversation; 
    isActive: boolean;
    onClick: () => void;
  }) => {
    const title = conversation.title || 'Untitled chat'
    const formattedDate = new Date(conversation.updatedAt || conversation.createdAt).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })

    return (
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-3 border-b border-border-light py-3 text-left outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-primary",
          isActive && "bg-surface-hover"
        )}
        onClick={onClick}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center">
          <ChatSquareLinear className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text-primary">{title}</span>
          <span className="block truncate text-xs text-text-secondary">{formattedDate}</span>
        </span>
      </button>
    )
  }
)
ConversationRow.displayName = 'ConversationRow'

export function ProjectChatList({
  conversations,
  activeConversationId,
  onSelectConversation,
  emptyLabel = "No chats found"
}: ProjectChatListProps) {
  if (!conversations.length) {
    return (
      <div className="py-12 text-center text-sm text-text-secondary">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="min-h-[280px] flex-1 overflow-hidden rounded-lg border border-border-light h-full overflow-y-auto">
      {conversations.map(convo => (
        <ConversationRow
          key={convo.conversationId}
          conversation={convo}
          isActive={convo.conversationId === activeConversationId}
          onClick={() => onSelectConversation(convo)}
        />
      ))}
    </div>
  )
}
