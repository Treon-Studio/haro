import type { ToolCallResult } from '../types/mcp';

export interface MemoryFabricConfig {
  baseUrl: string;
  apiKey?: string;
}

export class MemoryFabricService {
  private config: MemoryFabricConfig;

  constructor(config: MemoryFabricConfig) {
    this.config = config;
  }

  private async proxy(tool: string, args: Record<string, unknown>): Promise<{ result?: unknown; error?: string }> {
    const url = this.config.baseUrl.replace(/\/$/, '') + '/api/tool';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tool, args }),
    });

    if (!res.ok) {
      return { error: `Memory Fabric proxy error: ${res.status} ${res.statusText}` };
    }
    const data = await res.json() as { result?: unknown; error?: string };
    return data;
  }

  async memoryStore(args: Record<string, unknown>): Promise<ToolCallResult> {
    const { result, error } = await this.proxy('memory_store', args);
    if (error) return { content: [{ type: 'text' as const, text: error }], isError: true };
    return { content: [{ type: 'text' as const, text: String(result) }] };
  }

  async memorySearch(args: Record<string, unknown>): Promise<ToolCallResult> {
    const { result, error } = await this.proxy('memory_search', args);
    if (error) return { content: [{ type: 'text' as const, text: error }], isError: true };
    return { content: [{ type: 'text' as const, text: String(result) }] };
  }

  async memoryList(args: Record<string, unknown>): Promise<ToolCallResult> {
    const { result, error } = await this.proxy('memory_list', args);
    if (error) return { content: [{ type: 'text' as const, text: error }], isError: true };
    return { content: [{ type: 'text' as const, text: String(result) }] };
  }

  async memoryGet(args: Record<string, unknown>): Promise<ToolCallResult> {
    const { result, error } = await this.proxy('memory_get', args);
    if (error) return { content: [{ type: 'text' as const, text: error }], isError: true };
    return { content: [{ type: 'text' as const, text: String(result) }] };
  }

  async memoryDelete(args: Record<string, unknown>): Promise<ToolCallResult> {
    const { result, error } = await this.proxy('memory_delete', args);
    if (error) return { content: [{ type: 'text' as const, text: error }], isError: true };
    return { content: [{ type: 'text' as const, text: String(result) }] };
  }

  async gbrainPut(args: Record<string, unknown>): Promise<ToolCallResult> {
    const { result, error } = await this.proxy('gbrain_put', args);
    if (error) return { content: [{ type: 'text' as const, text: error }], isError: true };
    return { content: [{ type: 'text' as const, text: String(result) }] };
  }

  async gbrainGet(args: Record<string, unknown>): Promise<ToolCallResult> {
    const { result, error } = await this.proxy('gbrain_get', args);
    if (error) return { content: [{ type: 'text' as const, text: error }], isError: true };
    return { content: [{ type: 'text' as const, text: String(result) }] };
  }

  async gbrainSearch(args: Record<string, unknown>): Promise<ToolCallResult> {
    const { result, error } = await this.proxy('gbrain_search', args);
    if (error) return { content: [{ type: 'text' as const, text: error }], isError: true };
    return { content: [{ type: 'text' as const, text: String(result) }] };
  }

  async gbrainQuery(args: Record<string, unknown>): Promise<ToolCallResult> {
    const { result, error } = await this.proxy('gbrain_query', args);
    if (error) return { content: [{ type: 'text' as const, text: error }], isError: true };
    return { content: [{ type: 'text' as const, text: String(result) }] };
  }

  async gbrainList(args: Record<string, unknown>): Promise<ToolCallResult> {
    const { result, error } = await this.proxy('gbrain_list', args);
    if (error) return { content: [{ type: 'text' as const, text: error }], isError: true };
    return { content: [{ type: 'text' as const, text: String(result) }] };
  }

  async gbrainStats(args: Record<string, unknown>): Promise<ToolCallResult> {
    const { result, error } = await this.proxy('gbrain_stats', args);
    if (error) return { content: [{ type: 'text' as const, text: error }], isError: true };
    return { content: [{ type: 'text' as const, text: String(result) }] };
  }

  async vaultRead(args: Record<string, unknown>): Promise<ToolCallResult> {
    const { result, error } = await this.proxy('vault_read', args);
    if (error) return { content: [{ type: 'text' as const, text: error }], isError: true };
    return { content: [{ type: 'text' as const, text: String(result) }] };
  }

  async vaultWrite(args: Record<string, unknown>): Promise<ToolCallResult> {
    const { result, error } = await this.proxy('vault_write', args);
    if (error) return { content: [{ type: 'text' as const, text: error }], isError: true };
    return { content: [{ type: 'text' as const, text: String(result) }] };
  }

  async vaultList(args: Record<string, unknown>): Promise<ToolCallResult> {
    const { result, error } = await this.proxy('vault_list', args);
    if (error) return { content: [{ type: 'text' as const, text: error }], isError: true };
    return { content: [{ type: 'text' as const, text: String(result) }] };
  }

  async fabricHealth(): Promise<ToolCallResult> {
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { status: string; backends: Record<string, string> };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Health check failed: ${e}` }], isError: true };
    }
  }
}
