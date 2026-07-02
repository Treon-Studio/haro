import { kvGet, kvSet } from "./kvCrypto";
import { neonQuery } from "./neonClient";
import type { GatewayEnv, GatewaySettingRecord } from "./types";

const SETTINGS_TTL = 900; // 15 minutes
const SETTINGS_TIMEOUT_MS = 1000;
const inFlightRequests = new Map<string, Promise<string | null>>();

export async function getGatewaySetting(
	key: string,
	env: GatewayEnv,
	companyId?: string,
): Promise<string | null> {
	if (!env?.DATABASE_URL) return null;

	const cacheKey = companyId
		? `settings:${companyId}:${key}`
		: `settings:global:${key}`;

	const cached = await kvGet<string>(cacheKey, env);
	if (cached !== null) return cached;

	const existingPromise = inFlightRequests.get(cacheKey);
	if (existingPromise) return existingPromise;

	const promise = (async () => {
		const query = companyId
			? "SELECT key, value, company_id FROM public.gateway_settings WHERE key = $1 AND company_id = $2 LIMIT 1"
			: "SELECT key, value, company_id FROM public.gateway_settings WHERE key = $1 AND company_id IS NULL LIMIT 1";
		const params = companyId ? [key, companyId] : [key];

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(
				() => controller.abort(),
				SETTINGS_TIMEOUT_MS,
			);

			const rows = await neonQuery<GatewaySettingRecord>(query, params, env, {
				signal: controller.signal,
			});
			clearTimeout(timeoutId);

			if (!rows?.length) return null;

			const val = rows[0].value;
			await kvSet(cacheKey, val, env, SETTINGS_TTL);
			return val;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes("aborted")) {
				console.error(
					`[getGatewaySetting] Neon query timed out for key ${key}`,
				);
			} else {
				console.error(
					`[getGatewaySetting] Neon query failed for key ${key}:`,
					error,
				);
			}
			return null;
		} finally {
			inFlightRequests.delete(cacheKey);
		}
	})();

	inFlightRequests.set(cacheKey, promise);
	return promise;
}
