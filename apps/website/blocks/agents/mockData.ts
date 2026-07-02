export interface Category {
  value: string;
  label: string;
  description?: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  avatarUrl?: string;
}

export const mockCategories: Category[] = [
  { value: 'all', label: 'All Categories', description: 'Browse all available agents' },
  { value: 'promoted', label: 'Top Picks', description: 'Recommended for you' },
  { value: 'productivity', label: 'Productivity', description: 'Agents to help you get things done' },
  { value: 'coding', label: 'Coding', description: 'Agents to help you write code' },
  { value: 'writing', label: 'Writing', description: 'Agents to help you write' },
];

export const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'Code Assistant',
    description: 'An AI assistant that helps you write code, debug, and understand complex concepts.',
    category: 'coding',
    author: 'Admin',
  },
  {
    id: 'agent-2',
    name: 'Writing Coach',
    description: 'Improves your writing style and helps you brainstorm ideas.',
    category: 'writing',
    author: 'Admin',
  },
  {
    id: 'agent-3',
    name: 'Task Manager',
    description: 'Helps you organize your daily tasks and priorities.',
    category: 'productivity',
    author: 'Admin',
  },
  {
    id: 'agent-4',
    name: 'Data Analyst',
    description: 'Analyzes data sets and provides insights.',
    category: 'productivity',
    author: 'Admin',
  },
  {
    id: 'agent-5',
    name: 'SEO Expert',
    description: 'Helps you write SEO-optimized content.',
    category: 'writing',
    author: 'Admin',
  },
];
