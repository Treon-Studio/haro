import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { resolveConfigPreset } from "../../config/configPresetResolver";
import { resolveVirtualKey } from "../../config/virtualKeyResolver";
import { HEADER_KEYS } from "../../globals";

import type { GatewayEnv } from "../../config/types";

const VIRTUAL_KEY_HEADER = `x-haro-virtual-key`;
const CONFIG_ID_HEADER = `x-haro-config-id`;

const inMemoryRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;

async function checkAndIncrementRateLimit(
	vkSlug: string,
	rpm: number,
	env: GatewayEnv,
): Promise<{ allowed: boolean; remaining: number }> {
	const minuteTs = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
	const key = `rl:${vkSlug}:${minuteTs}`;
	const resetAt = (minuteTs + 1) * RATE_LIMIT_WINDOW_MS;

	if (env?.HARO_CONFIG_CACHE) {
		try {
			const stored = await env.HARO_CONFIG_CACHE.get(key);
			const current = stored ? parseInt(stored, 10) : 0;
			const newCount = current + 1;

			if (newCount > rpm) {
				return { allowed: false, remaining: Math.max(0, rpm - current) };
			}

			await env.HARO_CONFIG_CACHE.put(key, String(newCount), {
				expirationTtl: 120,
			});
			return { allowed: true, remaining: Math.max(0, rpm - newCount) };
		} catch {
			return { allowed: true, remaining: rpm };
		}
	}

	const now = Date.now();
	const entry = inMemoryRateLimit.get(key);

	if (!entry || entry.resetAt <= now) {
		inMemoryRateLimit.set(key, { count: 1, resetAt });
		return { allowed: true, remaining: rpm - 1 };
	}

	const newCount = entry.count + 1;
	if (newCount > rpm) {
		return { allowed: false, remaining: Math.max(0, rpm - entry.count) };
	}

	entry.count = newCount;
	return { allowed: true, remaining: Math.max(0, rpm - newCount) };
}

export const configResolver = async (c: Context, next: Next) => {
	const env = c.env as unknown as GatewayEnv;

	if (!env?.USE_DB_CONFIG || !env?.SUPABASE_URL) {
		return next();
	}

	const vkSlug = c.req.header(VIRTUAL_KEY_HEADER);
	if (vkSlug) {
		const resolved = await resolveVirtualKey(vkSlug, env);
		if (resolved) {
			if (resolved.rateLimitRpm && resolved.rateLimitRpm > 0) {
				const { allowed, remaining } = await checkAndIncrementRateLimit(
					vkSlug,
					resolved.rateLimitRpm,
					env,
				);
				if (!allowed) {
					c.header("X-RateLimit-Limit", String(resolved.rateLimitRpm));
					c.header("X-RateLimit-Remaining", String(remaining));
					c.header("Retry-After", "60");
					throw new HTTPException(429, {
						message: `Rate limit exceeded. Limit: ${resolved.rateLimitRpm} requests per minute.`,
					});
				}
				c.header("X-RateLimit-Limit", String(resolved.rateLimitRpm));
				c.header("X-RateLimit-Remaining", String(remaining));
			}

			c.req.raw.headers.set(HEADER_KEYS.PROVIDER, resolved.provider);
			c.req.raw.headers.set("Authorization", `Bearer ${resolved.apiKey}`);
		}
	}

	const configSlug = c.req.header(CONFIG_ID_HEADER);
	if (configSlug) {
		const config = await resolveConfigPreset(configSlug, env);
		if (config) {
			c.req.raw.headers.set(HEADER_KEYS.CONFIG, JSON.stringify(config));
		}
	}

	return next();
};
