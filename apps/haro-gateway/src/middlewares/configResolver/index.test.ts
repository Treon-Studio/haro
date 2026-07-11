import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { resolveConfigPreset } from "../../config/configPresetResolver";
import { resolveVirtualKey } from "../../config/virtualKeyResolver";
import { HEADER_KEYS } from "../../globals";
import { configResolver } from "./index";

jest.mock("../../config/virtualKeyResolver", () => ({
	resolveVirtualKey: jest.fn(),
}));

jest.mock("../../config/configPresetResolver", () => ({
	resolveConfigPreset: jest.fn(),
}));

describe("configResolver middleware", () => {
	// biome-ignore lint/suspicious/noExplicitAny: test fixture — mock hono context shape
	let mockContext: any;
	let mockNext: jest.Mock;
	// biome-ignore lint/suspicious/noExplicitAny: test fixture — mock env object
	let mockEnv: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockNext = jest.fn().mockResolvedValue(undefined);

		const headers = new Map<string, string>();
		const rawHeaders = new Map<string, string>();

		mockEnv = {
			USE_DB_CONFIG: "true",
			SUPABASE_URL: "https://test.supabase.co",
			HARO_CONFIG_CACHE: {
				store: new Map<string, string>(),
				get: jest
					.fn()
					.mockImplementation(
						async (key: string) =>
							mockEnv.HARO_CONFIG_CACHE.store.get(key) || null,
					),
				put: jest.fn().mockImplementation(async (key: string, val: string) => {
					mockEnv.HARO_CONFIG_CACHE.store.set(key, val);
				}),
			},
		};

		mockContext = {
			env: mockEnv,
			req: {
				header: jest.fn((key: string) => headers.get(key) || null),
				raw: {
					headers: {
						set: jest.fn((key: string, value: string) =>
							rawHeaders.set(key, value),
						),
					},
				},
			},
			header: jest.fn(),
		} as unknown as Context;

		headers.set("x-haro-virtual-key", "vk_test");
		headers.set("x-haro-config-id", "cfg_test");
	});

	it("bypasses if USE_DB_CONFIG or SUPABASE_URL are absent", async () => {
		mockContext.env.USE_DB_CONFIG = undefined;
		await configResolver(mockContext, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(resolveVirtualKey).not.toHaveBeenCalled();
	});

	it("resolves virtual key and injects provider and apiKey", async () => {
		(resolveVirtualKey as jest.Mock).mockResolvedValueOnce({
			provider: "openai",
			apiKey: "sk-test-123",
			rateLimitRpm: null, // no rate limit
		});
		(resolveConfigPreset as jest.Mock).mockResolvedValueOnce(null);

		await configResolver(mockContext, mockNext);

		expect(resolveVirtualKey).toHaveBeenCalledWith("vk_test", mockEnv);
		expect(mockContext.req.raw.headers.set).toHaveBeenCalledWith(
			HEADER_KEYS.PROVIDER,
			"openai",
		);
		expect(mockContext.req.raw.headers.set).toHaveBeenCalledWith(
			"Authorization",
			"Bearer sk-test-123",
		);
		expect(mockNext).toHaveBeenCalled();
	});

	it("enforces rate limit using KV cache", async () => {
		(resolveVirtualKey as jest.Mock).mockResolvedValue({
			provider: "anthropic",
			apiKey: "sk-test-abc",
			rateLimitRpm: 2, // 2 requests per minute limit
		});
		(resolveConfigPreset as jest.Mock).mockResolvedValue(null);

		// 1st request - Should pass (count = 1)
		await configResolver(mockContext, mockNext);
		expect(mockContext.header).toHaveBeenCalledWith("X-RateLimit-Limit", "2");
		expect(mockContext.header).toHaveBeenCalledWith(
			"X-RateLimit-Remaining",
			"1",
		);

		// 2nd request - Should pass (count = 2)
		await configResolver(mockContext, mockNext);
		expect(mockContext.header).toHaveBeenCalledWith(
			"X-RateLimit-Remaining",
			"0",
		);

		// 3rd request - Should fail (count = 3 > 2)
		let error: HTTPException | null = null;
		try {
			await configResolver(mockContext, mockNext);
		} catch (err) {
			error = err as HTTPException;
		}

		expect(error).toBeInstanceOf(HTTPException);
		expect(error?.status).toBe(429);
	});
});
