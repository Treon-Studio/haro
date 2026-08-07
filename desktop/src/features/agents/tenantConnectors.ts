export interface ConnectorConfig {
  id: string;
  provider:
    | "google_calendar"
    | "outlook_calendar"
    | "google_drive"
    | "notion"
    | "jira";
  tenantId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export class TenantConnectorsManager {
  private connectors: Map<string, ConnectorConfig[]> = new Map();

  async getConnectors(tenantId: string): Promise<ConnectorConfig[]> {
    return this.connectors.get(tenantId) || [];
  }

  async addConnector(tenantId: string, config: ConnectorConfig): Promise<void> {
    const existing = await this.getConnectors(tenantId);
    this.connectors.set(tenantId, [...existing, config]);
  }

  async removeConnector(tenantId: string, connectorId: string): Promise<void> {
    const existing = await this.getConnectors(tenantId);
    this.connectors.set(
      tenantId,
      existing.filter((c) => c.id !== connectorId),
    );
  }
}

export const tenantConnectorsManager = new TenantConnectorsManager();
