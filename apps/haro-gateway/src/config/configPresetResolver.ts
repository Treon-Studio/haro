import { kvGet, kvSet } from "./kvCrypto";
import { neonQuery } from "./neonClient";
import type { ConfigPresetRecord, GatewayEnv } from "./types";

const CFG_TTL = 600; // 10 minutes
const inFlightRequests = new Map<
	string,
	Promise<Record<string, unknown> | null>
>();

export async function resolveConfigPreset(
	slug: string,
	env: GatewayEnv,
): Promise<Record<string, unknown> | null> {
	if (!slug) return null;

	const cached = await kvGet<Record<string, unknown>>(`cfg:${slug}`, env);
	if (cached) return cached;

	const existingPromise = inFlightRequests.get(slug);
	if (existingPromise) return existingPromise;

	const promise = (async () => {
		try {
			const rows = await neonQuery<Pick<ConfigPresetRecord, "config">>(
				"SELECT config FROM public.gateway_configs WHERE slug = $1 AND is_active = true LIMIT 1",
				[slug],
				env,
			);
			if (!rows?.length) return null;

			const config = rows[0].config;
			await kvSet(`cfg:${slug}`, config, env, CFG_TTL);
			return config;
		} catch (error) {
			console.error(
				`[resolveConfigPreset] Neon query failed for slug ${slug}:`,
				error,
			);
			return null;
		} finally {
			inFlightRequests.delete(slug);
		}
	})();

	inFlightRequests.set(slug, promise);
	return promise;
}
