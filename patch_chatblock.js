const fs = require('fs');
const file = '/Users/ridho/Documents/go/github.com/raizora/tenang/apps/website/blocks/chat/index.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '<Sidebar',
  '<Sidebar\n                activeTab={view}'
);

fs.writeFileSync(file, content);
