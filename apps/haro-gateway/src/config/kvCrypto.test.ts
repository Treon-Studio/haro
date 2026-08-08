import { kvGet, kvSet, kvDel } from "./kvCrypto";
import type { GatewayEnv } from "./types";

// Mock KV namespace
const createMockKV = () => {
	const store = new Map<string, string>();
	return {
		get: jest.fn(async (key: string) => store.get(key) ?? null),
		put: jest.fn(async (key: string, value: string) => {
			store.set(key, value);
		}),
		delete: jest.fn(async (key: string) => {
			store.delete(key);
		}),
		_store: store,
	};
};

// biome-ignore lint/suspicious/noExplicitAny: test helper needs to accept any mock KV shape for flexibility
const makeEnv = (kv: any) =>
	({
		SUPABASE_URL: "https://test.supabase.co",
		SUPABASE_SERVICE_ROLE_KEY: "key",
		DATABASE_URL: "postgresql://u:p@ep-test.neon.tech/db",
		KV_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
		// biome-ignore lint/suspicious/noExplicitAny: test mock doesn't fully match CF KVNamespace
		HARO_CONFIG_CACHE: kv as any,
	}) as unknown as GatewayEnv;

describe("kvCrypto", () => {
	it("returns null when key does not exist", async () => {
		const kv = createMockKV();
		const result = await kvGet("missing-key", makeEnv(kv));
		expect(result).toBeNull();
	});

	it("roundtrips: set then get returns original value", async () => {
		const kv = createMockKV();
		const env = makeEnv(kv);
		const original = { provider: "openai", apiKey: "sk-test-123" };
		await kvSet("vk:vk_abc123", original, env, 300);
		const result = await kvGet<typeof original>("vk:vk_abc123", env);
		expect(result).toEqual(original);
	});

	it("encrypted value in KV is not plaintext", async () => {
		const kv = createMockKV();
		const env = makeEnv(kv);
		await kvSet("vk:test", { secret: "my-api-key" }, env, 300);
		// biome-ignore lint/style/noNonNullAssertion: value was just stored, it must exist
		const stored = kv._store.get("vk:test")!;
		expect(stored).not.toContain("my-api-key");
	});

	it("kvDel removes key", async () => {
		const kv = createMockKV();
		const env = makeEnv(kv);
		await kvSet("vk:del_test", { x: 1 }, env, 300);
		await kvDel("vk:del_test", env);
		const result = await kvGet("vk:del_test", env);
		expect(result).toBeNull();
	});
});
