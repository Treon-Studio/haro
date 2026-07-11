import type { GatewayEnv } from "./types";

export async function neonQuery<T>(
	query: string,
	params: unknown[],
	env: GatewayEnv,
	options?: { signal?: AbortSignal },
): Promise<T[]> {
	if (!env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not configured");
	}

	// Parse postgresql://user:pass@host/db or postgres://user:pass@host/db to https://host/sql
	const urlString = env.DATABASE_URL.replace(
		/^(postgres|postgresql):\/\//,
		"https://",
	);
	const url = new URL(urlString);
	const sqlEndpoint = `https://${url.host}/sql`;

	// Use explicit NEON_API_KEY if configured, otherwise extract password or username from URL
	const token = env.NEON_API_KEY || url.password || url.username;

	if (!token) {
		throw new Error(
			"Neon authorization token is missing — configure NEON_API_KEY or set password in DATABASE_URL",
		);
	}

	const response = await fetch(sqlEndpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ query, params }),
		signal: options?.signal,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Neon HTTP SQL failed (${response.status}): ${errorText}`);
	}

	const result = await response.json();
	if (typeof result !== "object" || result === null) {
		throw new Error("Neon HTTP SQL returned an invalid non-object response");
	}

	const rows = (result as { rows?: unknown }).rows;
	if (rows !== undefined && !Array.isArray(rows)) {
		throw new Error(
			"Neon HTTP SQL returned an invalid rows structure (not an array)",
		);
	}

	return (rows as T[]) || [];
}
