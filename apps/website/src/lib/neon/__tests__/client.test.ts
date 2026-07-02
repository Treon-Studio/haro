import { describe, it, expect, vi, beforeEach } from "vitest";

// Define mock DATABASE_URL before importing client to bypass configured checks
if (typeof process !== "undefined") {
  process.env.DATABASE_URL = "postgresql://mock_user:mock_pw@localhost:5432/mock_db";
}

// Fully mock the @neondatabase/serverless Pool class to prevent real WebSocket connection handshakes
vi.mock("@neondatabase/serverless", () => {
  const mockPoolConnect = vi.fn();
  class MockPool {
    connect = mockPoolConnect;
  }
  return {
    Pool: MockPool,
  };
});

import { query, transaction, pool } from "../client";

describe("Neon Connection Pool Helpers", () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(mockClient);
  });

  describe("query helper", () => {
    it("should successfully execute a raw SQL query and release the client", async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1, name: "Acme" }], rowCount: 1 });

      const result = await query("SELECT * FROM companies WHERE id = $1", [1]);

      expect(pool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith("SELECT * FROM companies WHERE id = $1", [1]);
      expect(mockClient.release).toHaveBeenCalled();
      expect(result.rows).toEqual([{ id: 1, name: "Acme" }]);
    });

    it("should throw an error and release client if query execution fails", async () => {
      mockClient.query.mockRejectedValueOnce(new Error("Database failure"));

      await expect(query("SELECT * FROM invalid_table")).rejects.toThrow("Database failure");

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("transaction helper", () => {
    it("should execute BEGIN, COMMIT, and release client on success", async () => {
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await transaction(async (tx) => {
        await tx.query("INSERT INTO companies (name) VALUES ($1)", ["Test Co"]);
        return "success";
      });

      expect(pool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenNthCalledWith(1, "BEGIN");
      expect(mockClient.query).toHaveBeenNthCalledWith(2, "INSERT INTO companies (name) VALUES ($1)", ["Test Co"]);
      expect(mockClient.query).toHaveBeenNthCalledWith(3, "COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe("success");
    });

    it("should execute ROLLBACK and release client on exception", async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN succeeds
      
      await expect(
        transaction(async (tx) => {
          await tx.query("INSERT INTO companies (name) VALUES ($1)", ["Test Co"]);
          throw new Error("Trigger rollback");
        })
      ).rejects.toThrow("Trigger rollback");

      expect(pool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenNthCalledWith(1, "BEGIN");
      expect(mockClient.query).toHaveBeenNthCalledWith(3, "ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
