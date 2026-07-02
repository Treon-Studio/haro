const fs = require('fs');
const path = require('path');

// 1. Add globals.css to ChatLayout.astro
const chatLayoutPath = '/Users/ridho/Documents/go/github.com/raizora/tenang/apps/website/src/layouts/ChatLayout.astro';
let chatLayout = fs.readFileSync(chatLayoutPath, 'utf8');
if (!chatLayout.includes("import '@/styles/globals.css'")) {
  chatLayout = chatLayout.replace('---', "---\nimport '@/styles/globals.css'");
  fs.writeFileSync(chatLayoutPath, chatLayout);
}

// 2. Patch the Astro pages
const pages = [
  { name: 'agents', viewName: 'AgentMarketplace' },
  { name: 'projects', viewName: 'ProjectsView' },
  { name: 'prompts', viewName: 'PromptsView' },
  { name: 'skills', viewName: 'SkillsView' }
];

pages.forEach(page => {
  const file = `/Users/ridho/Documents/go/github.com/raizora/tenang/apps/website/src/pages/${page.name}/index.astro`;
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace imports
    content = content.replace("import BaseLayout from '@/layouts/BaseLayout.astro';", "import ChatLayout from '@/layouts/ChatLayout.astro';\nimport { ChatBlock } from '@/../blocks/chat/index';");
    content = content.replace(new RegExp(`import ${page.viewName}.*?\\n`), '');
    
    // Replace Layout tags
    content = content.replace(/<BaseLayout/g, '<ChatLayout');
    content = content.replace(/<\/BaseLayout>/g, '</ChatLayout>');
    
    // Replace View tags
    content = content.replace(new RegExp(`<${page.viewName} client:load />`), `<ChatBlock view="${page.name}" client:load />`);
    
    fs.writeFileSync(file, content);
  }
});
