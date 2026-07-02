const fs = require('fs');
const file = '/Users/ridho/Documents/go/github.com/raizora/tenang/apps/website/blocks/chat/components/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import for SkillsSidebar
content = content.replace(
  "import { Tooltip, TooltipTrigger, TooltipContent } from '@treonstudio/bungas-core/ui/tooltip';",
  "import { Tooltip, TooltipTrigger, TooltipContent } from '@treonstudio/bungas-core/ui/tooltip';\nimport SkillsSidebar from '../../skills/SkillsSidebar';"
);

// Replace "Coming soon" for skills with SkillsSidebar
content = content.replace(
  "{activeTab !== 'chat' && (",
  "{activeTab === 'skills' && <SkillsSidebar />}\n                {activeTab !== 'chat' && activeTab !== 'skills' && ("
);

fs.writeFileSync(file, content);
