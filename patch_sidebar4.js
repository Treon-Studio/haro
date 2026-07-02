const fs = require('fs');
const file = '/Users/ridho/Documents/go/github.com/raizora/tenang/apps/website/blocks/chat/components/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import for PromptSidebar
content = content.replace(
  "import SkillsSidebar from '../../skills/SkillsSidebar';",
  "import SkillsSidebar from '../../skills/SkillsSidebar';\nimport { PromptSidebar } from '../../prompts/PromptSidebar';"
);

// Replace "Coming soon" for prompts with PromptSidebar
content = content.replace(
  "{activeTab !== 'chat' && activeTab !== 'skills' && (",
  "{activeTab === 'prompts' && <PromptSidebar />}\n                {activeTab !== 'chat' && activeTab !== 'skills' && activeTab !== 'prompts' && ("
);

fs.writeFileSync(file, content);
