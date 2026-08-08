import type { GatewayEnv } from "./types";

export async function supabaseFetch(
	path: string,
	env: GatewayEnv,
	options: RequestInit = {},
): Promise<Response> {
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
		throw new Error(
			"Supabase configuration is missing in environment variables",
		);
	}

	const url = `${env.SUPABASE_URL}${path}`;
	return fetch(url, {
		...options,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
			apikey: env.SUPABASE_SERVICE_ROLE_KEY,
			Prefer: "return=representation",
			...((options.headers as Record<string, string>) || {}),
		},
	});
}
