export interface MessageNode {
  id: string;
  parentMessageId?: string;
  children?: MessageNode[];
  [key: string]: unknown;
}

export function buildMessageTree(messages: MessageNode[]): MessageNode[] {
  const messageMap = new Map<string, MessageNode & { children: MessageNode[] }>();
  
  // Clone nodes to avoid mutating the original input array's objects
  messages.forEach((msg) => {
    messageMap.set(msg.id, { ...msg, children: [] });
  });

  const roots: MessageNode[] = [];

  messages.forEach((msg) => {
    const node = messageMap.get(msg.id)!;
    if (msg.parentMessageId && messageMap.has(msg.parentMessageId)) {
      const parentNode = messageMap.get(msg.parentMessageId)!;
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}
