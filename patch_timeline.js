const fs = require('fs');
const path = 'desktop/src/features/messages/ui/MessageTimeline.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /import \* as React from "react";/,
  `import * as React from "react";\nimport { fetchChannelMessages, type SimpleChatMessage } from "@/shared/api/simpleChatStore";\nimport { simpleSocket } from "@/shared/api/simpleSocket";`
);

const fetchCode = `
  const [internalMessages, setInternalMessages] = React.useState<TimelineMessage[]>([]);
  React.useEffect(() => {
    if (!channelId) return;
    let mounted = true;
    fetchChannelMessages(channelId).then(msgs => {
      if (mounted) setInternalMessages(msgs);
    }).catch(console.error);

    const handleMessage = (payload: any) => {
      if (payload.channelId === channelId) {
        setInternalMessages(prev => {
          if (prev.find(m => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
      }
    };
    simpleSocket.on('message_send', handleMessage);
    return () => {
      mounted = false;
      simpleSocket.off('message_send', handleMessage);
    };
  }, [channelId]);

  const messagesToUse = internalMessages.length > 0 ? internalMessages : messages;
`;

content = content.replace(
  /const internalScrollRef = React\.useRef<HTMLDivElement>\(null\);/,
  fetchCode + '\n  const internalScrollRef = React.useRef<HTMLDivElement>(null);'
);

content = content.replace(/messages: messages,/g, 'messages: messagesToUse,');
content = content.replace(/messages\.length/g, 'messagesToUse.length');
content = content.replace(/messages\)/g, 'messagesToUse)');
content = content.replace(/, messages/g, ', messagesToUse');
// Replace liveSnapshot
content = content.replace(/messages, historyExhausted/g, 'messages: messagesToUse, historyExhausted');

fs.writeFileSync(path, content);
