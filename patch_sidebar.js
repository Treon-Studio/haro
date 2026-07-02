const fs = require('fs');
const file = '/Users/ridho/Documents/go/github.com/raizora/tenang/apps/website/blocks/chat/components/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

const iconSkills = `
const IconSkills = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
);
`;

content = content.replace('const IconBrain = () => (', iconSkills + '\nconst IconBrain = () => (');

content = content.replace(
  "const [activeTab, setActiveTab] = useState<'chats' | 'agents' | 'prompts' | 'files'>('chats');",
  "const [activeTab, setActiveTab] = useState<'chats' | 'agents' | 'prompts' | 'files' | 'skills'>('chats');"
);

const skillsButton = `
                <NavIconButton title="Skills" onClick={() => window.location.href = '/skills'} active={activeTab === 'skills'}>
                    <IconSkills />
                </NavIconButton>`;

content = content.replace(
  "<NavIconButton title=\"Files\"",
  skillsButton + "\n                <NavIconButton title=\"Files\""
);

content = content.replace(
  "onClick={() => { setActiveTab('agents'); if (!open) onToggle(); }}",
  "onClick={() => window.location.href = '/agents'}"
);

content = content.replace(
  "onClick={() => { setActiveTab('prompts'); if (!open) onToggle(); }}",
  "onClick={() => window.location.href = '/prompts'}"
);

fs.writeFileSync(file, content);
