'use client'

import { createContext, useContext } from 'react'

/**
 * context for the chat container's content width.
 * set by ChatMessages, consumed by MessageBubble for shrinkwrap.
 */
export const ChatWidthContext = createContext<number>(0)

export function useChatWidth(): number {
  return useContext(ChatWidthContext)
}
