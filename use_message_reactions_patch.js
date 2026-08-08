const fs = require('fs');
const path = 'desktop/src/features/messages/ui/MessageReactions.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /import { Popover, PopoverContent, PopoverTrigger } from "@\/shared\/ui\/popover";/,
  `import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";\nimport { simpleSocket } from "@/shared/api/simpleSocket";\nimport { addMessageReaction } from "@/shared/api/simpleChatStore";`
);

const handleSelectReplacement = `
  const handleSelect = React.useCallback((emoji: string) => {
    onSelect(emoji);
    simpleSocket.send('reaction_add', { messageId, emoji });
    addMessageReaction({ messageId, emoji }).catch(err => {
      console.error('Failed to add reaction:', err);
    });
  }, [onSelect, messageId]);
`;

content = content.replace(
  /const badgeBurstEmoji = burstEmojiOnRender \?\? pendingBadgeBurstEmoji;/,
  `const badgeBurstEmoji = burstEmojiOnRender ?? pendingBadgeBurstEmoji;\n${handleSelectReplacement}`
);

content = content.replace(
  /onSelect=\{onSelect\}/g,
  `onSelect={handleSelect}`
);

// We need to fix the first onSelect={onSelect} from the prop destructuring though, let's just make sure it didn't mess up.
// Actually, it will replace onSelect={onSelect} in the JSX which is exactly what we want.
fs.writeFileSync(path, content);
