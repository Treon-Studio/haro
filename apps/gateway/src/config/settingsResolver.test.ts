import { kvGet, kvSet } from "./kvCrypto";
import { neonQuery } from "./neonClient";
import { getGatewaySetting } from "./settingsResolver";
import type { GatewayEnv } from "./types";

jest.mock("./kvCrypto", () => ({
	kvGet: jest.fn(),
	kvSet: jest.fn(),
}));
jest.mock("./neonClient", () => ({
	neonQuery: jest.fn(),
}));

const mockEnv = {
	DATABASE_URL: "postgresql://u:p@ep-test.neon.tech/db",
	KV_ENCRYPTION_KEY: "k",
	HARO_CONFIG_CACHE: {},
} as unknown as GatewayEnv;

describe("getGatewaySetting", () => {
	let consoleErrorSpy: jest.SpyInstance;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	it("returns null when env not configured", async () => {
		const result = await getGatewaySetting("admin_token", {} as GatewayEnv);
		expect(result).toBeNull();
	});

	it("returns cached value from KV", async () => {
		(kvGet as jest.Mock).mockResolvedValueOnce("cached-token");
		const result = await getGatewaySetting("admin_token", mockEnv);
		expect(result).toBe("cached-token");
		expect(neonQuery).not.toHaveBeenCalled();
	});

	it("queries Neon on miss and caches", async () => {
		(kvGet as jest.Mock).mockResolvedValueOnce(null);
		(neonQuery as jest.Mock).mockResolvedValueOnce([
			{ key: "admin_token", value: "db-token", company_id: null },
		]);
		const result = await getGatewaySetting("admin_token", mockEnv);
		expect(result).toBe("db-token");
		expect(neonQuery).toHaveBeenCalledWith(
			expect.stringContaining(
				"SELECT key, value, company_id FROM public.gateway_settings",
			),
			["admin_token"],
			mockEnv,
			expect.any(Object),
		);
		expect(kvSet).toHaveBeenCalledWith(
			"settings:global:admin_token",
			"db-token",
			mockEnv,
			900,
		);
	});

	it("queries Neon with companyId on miss and caches", async () => {
		(kvGet as jest.Mock).mockResolvedValueOnce(null);
		(neonQuery as jest.Mock).mockResolvedValueOnce([
			{ key: "admin_token", value: "db-token-company", company_id: "co_123" },
		]);
		const result = await getGatewaySetting("admin_token", mockEnv, "co_123");
		expect(result).toBe("db-token-company");
		expect(neonQuery).toHaveBeenCalledWith(
			expect.stringContaining(
				"SELECT key, value, company_id FROM public.gateway_settings",
			),
			["admin_token", "co_123"],
			mockEnv,
			expect.any(Object),
		);
		expect(kvSet).toHaveBeenCalledWith(
			"settings:co_123:admin_token",
			"db-token-company",
			mockEnv,
			900,
		);
	});

	it("handles fetch failures from Neon gracefully by returning null", async () => {
		(kvGet as jest.Mock).mockResolvedValueOnce(null);
		(neonQuery as jest.Mock).mockRejectedValueOnce(
			new Error("Connection lost"),
		);

		const result = await getGatewaySetting("admin_token", mockEnv);
		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalled();
	});

	it("handles Neon timeout gracefully by returning null", async () => {
		jest.useFakeTimers();
		(kvGet as jest.Mock).mockResolvedValueOnce(null);

		// Return a promise that rejects when aborted
		(neonQuery as jest.Mock).mockImplementationOnce(
			(_query, _params, _env, opts) => {
				return new Promise((_resolve, reject) => {
					if (opts?.signal) {
						opts.signal.addEventListener("abort", () => {
							reject(new Error("The user aborted a request."));
						});
					}
				});
			},
		);

		const promise = getGatewaySetting("admin_token", mockEnv);

		// Flush microtasks so the code after await kvGet executes and sets up the setTimeout
		await Promise.resolve();
		await Promise.resolve();

		// Advance timers by 1000ms to trigger the timeout
		jest.advanceTimersByTime(1000);

		const result = await promise;
		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalled();

		jest.useRealTimers();
	});
});
