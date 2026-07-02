export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface MessageContentPart {
  type: 'text' | 'image' | 'file';
  text?: string;
  image?: string;
  file?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt?: Date;
  attachments?: { id: string; name: string; dataUrl?: string }[];
  isStreaming?: boolean;
  error?: boolean;
}
