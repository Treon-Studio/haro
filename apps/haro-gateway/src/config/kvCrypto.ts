import type { GatewayEnv } from "./types";

const getCrypto = (): Crypto => {
	if (globalThis.crypto) {
		return globalThis.crypto;
	}
	throw new Error("WebCrypto is not available in this environment");
};

let cachedKey: CryptoKey | null = null;

function validateEncryptionKey(base64Key: string): void {
	if (!base64Key || base64Key.length < 16) {
		throw new Error(
			"KV_ENCRYPTION_KEY is missing or too short (minimum 16 chars base64)",
		);
	}
}

async function importKey(base64Key: string): Promise<CryptoKey> {
	if (cachedKey) return cachedKey;
	validateEncryptionKey(base64Key);
	const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
	if (raw.byteLength === 0) {
		throw new Error(
			"KV_ENCRYPTION_KEY decodes to an empty key — check the value",
		);
	}
	const crypto = getCrypto();
	cachedKey = await crypto.subtle.importKey(
		"raw",
		raw,
		"AES-GCM",
		false,
		["encrypt", "decrypt"],
	);
	return cachedKey;
}

async function encrypt(data: string, key: CryptoKey): Promise<string> {
	const crypto = getCrypto();
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(data);
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		encoded,
	);
	const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
	combined.set(iv, 0);
	combined.set(new Uint8Array(ciphertext), iv.byteLength);
	return btoa(String.fromCharCode(...combined));
}

async function decrypt(base64: string, key: CryptoKey): Promise<string> {
	const crypto = getCrypto();
	const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
	const iv = combined.slice(0, 12);
	const ciphertext = combined.slice(12);
	const plaintext = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		key,
		ciphertext,
	);
	return new TextDecoder().decode(plaintext);
}

export async function kvGet<T>(
	key: string,
	env: GatewayEnv,
): Promise<T | null> {
	if (!env.HARO_CONFIG_CACHE) return null;
	const encrypted = await env.HARO_CONFIG_CACHE.get(key);
	if (!encrypted) return null;
	const cryptoKey = await importKey(env.KV_ENCRYPTION_KEY);
	const json = await decrypt(encrypted, cryptoKey);
	return JSON.parse(json) as T;
}

export async function kvSet(
	key: string,
	value: unknown,
	env: GatewayEnv,
	ttlSeconds: number,
): Promise<void> {
	if (!env.HARO_CONFIG_CACHE) return;
	const cryptoKey = await importKey(env.KV_ENCRYPTION_KEY);
	const encrypted = await encrypt(JSON.stringify(value), cryptoKey);
	await env.HARO_CONFIG_CACHE.put(key, encrypted, {
		expirationTtl: ttlSeconds,
	});
}

export async function kvDel(key: string, env: GatewayEnv): Promise<void> {
	if (!env.HARO_CONFIG_CACHE) return;
	await env.HARO_CONFIG_CACHE.delete(key);
}