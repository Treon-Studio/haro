export interface Model {
  id: string;
  label: string;
  description?: string;
  provider: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
  apiKeyLabel: string;
  supportsStreaming: boolean;
  supportsTools: boolean;
  headers?: Record<string, string>;
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    apiKeyLabel: 'OpenRouter API Key',
    supportsStreaming: true,
    supportsTools: true,
    headers: {
      'HTTP-Referer': 'https://tenang-web.developerredant.workers.dev',
      'X-Title': 'Tenang AI',
    },
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    apiKeyLabel: 'DeepSeek API Key',
    supportsStreaming: true,
    supportsTools: true,
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    apiKeyLabel: 'OpenAI API Key',
    supportsStreaming: true,
    supportsTools: true,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    apiKeyLabel: 'Anthropic API Key',
    supportsStreaming: true,
    supportsTools: true,
    headers: {
      'anthropic-version': '2023-06-01',
    },
  },
  google: {
    id: 'google',
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKeyEnv: 'GOOGLE_API_KEY',
    apiKeyLabel: 'Google API Key',
    supportsStreaming: true,
    supportsTools: true,
  },
};

export const MODELS: Model[] = [
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super 120B', description: 'NVIDIA (Free)', provider: 'openrouter' },
  { id: 'mistralai/mistral-nemo:free', label: 'Mistral Nemo', description: 'Mistral (Free)', provider: 'openrouter' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B', description: 'Meta (Free)', provider: 'openrouter' },
  { id: 'google/gemini-2.5-flash:free', label: 'Gemini 2.5 Flash', description: 'Google (Free)', provider: 'openrouter' },
  { id: 'deepseek/deepseek-chat:free', label: 'DeepSeek V3', description: 'DeepSeek (Free)', provider: 'openrouter' },
  { id: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B', description: 'Alibaba (Free)', provider: 'openrouter' },
  { id: 'meta-llama/llama-3-8b-instruct:free', label: 'Llama 3 8B', description: 'Meta (Free fallback)', provider: 'openrouter' },
  { id: 'huggingface/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B', description: 'Meta (Free fallback)', provider: 'openrouter' },
  { id: 'deepseek-chat', label: 'DeepSeek Chat', description: 'Direct DeepSeek API', provider: 'deepseek' },
  { id: 'deepseek-reasoner', label: 'DeepSeek R1', description: 'Reasoning model (Direct DeepSeek)', provider: 'deepseek' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', description: 'Fast and affordable', provider: 'openai' },
  { id: 'gpt-4o', label: 'GPT-4o', description: 'Most capable', provider: 'openai' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', description: 'Latest GPT-4.1', provider: 'openai' },
  { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet', description: 'Anthropic flagship', provider: 'anthropic' },
  { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet', description: 'Latest Claude', provider: 'anthropic' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', description: 'Google Gemini', provider: 'google' },
];

export function getProvider(providerId: string): ProviderConfig | undefined {
  return PROVIDERS[providerId];
}

export function getModelsForProvider(providerId: string): Model[] {
  return MODELS.filter((model) => model.provider === providerId);
}

export function getModel(modelId: string): Model | undefined {
  return MODELS.find((model) => model.id === modelId);
}

export function loadApiKey(providerId: string): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(`tenang:apiKey:${providerId}`) || '';
}

export function saveApiKey(providerId: string, key: string): void {
  if (typeof window === 'undefined') return;
  if (key) {
    localStorage.setItem(`tenang:apiKey:${providerId}`, key);
  } else {
    localStorage.removeItem(`tenang:apiKey:${providerId}`);
  }
}

