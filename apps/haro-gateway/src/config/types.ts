export interface GatewayEnv {
	DATABASE_URL: string;
	NEON_API_KEY?: string;
	SUPABASE_URL?: string;
	SUPABASE_SERVICE_ROLE_KEY?: string;
	KV_ENCRYPTION_KEY: string;
	USE_DB_CONFIG?: string;
	HARO_CONFIG_CACHE?: KVNamespace; // Cloudflare KV binding
}

export interface VirtualKeyRecord {
	id: string;
	slug: string;
	provider: string;
	encrypted_key: string;
	masked_key: string;
	is_active: boolean;
	rate_limit_rpm: number | null;
	company_id: string;
}

export interface ResolvedVirtualKey {
	provider: string;
	apiKey: string;
	rateLimitRpm: number | null;
}

export interface ConfigPresetRecord {
	id: string;
	slug: string;
	config: Record<string, unknown>;
	is_active: boolean;
	company_id: string;
}

export interface GatewaySettingRecord {
	key: string;
	value: string;
	company_id: string | null;
}
