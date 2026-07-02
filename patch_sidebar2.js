const fs = require('fs');
const file = '/Users/ridho/Documents/go/github.com/raizora/tenang/apps/website/blocks/chat/components/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update SidebarProps
content = content.replace(
  'interface SidebarProps {',
  "interface SidebarProps {\n    activeTab?: 'chat' | 'agents' | 'prompts' | 'files' | 'skills' | 'projects' | 'search';"
);

// 2. Add activeTab prop to Sidebar function signature and remove local activeTab state
content = content.replace(
  'export default function Sidebar({',
  "export default function Sidebar({\n    activeTab = 'chat',"
);

// Remove the useState line for activeTab
content = content.replace(
  "const [activeTab, setActiveTab] = useState<'chats' | 'agents' | 'prompts' | 'files' | 'skills'>('chats');",
  ""
);

// 3. Change click handlers to use window.location.href
content = content.replace(
  "onClick={() => { setActiveTab('chats'); if (!open) onToggle(); }}",
  "onClick={() => window.location.href = '/c'}"
);
content = content.replace(
  "onClick={() => { setActiveTab('files'); if (!open) onToggle(); }}",
  "onClick={() => window.location.href = '/files'}"
);

// Also replace `activeTab === 'chats'` with `activeTab === 'chat'` since the view name is 'chat'
content = content.replace(/activeTab === 'chats'/g, "activeTab === 'chat'");

fs.writeFileSync(file, content);
