import { describe, it, expect, vi, beforeEach } from "vitest";
import { NeonCompatClient, QueryBuilder } from "../compat";

const mockQuery = vi.fn();
vi.mock("@/lib/neon/client", () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

const mockVerifySession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  verifySession: (...args: any[]) => mockVerifySession(...args),
}));

describe("QueryBuilder", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("SELECT", () => {
    it("compiles standard select with all filters and executes", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: "Project A" }] });

      const builder = new QueryBuilder("projects")
        .select("id, name")
        .eq("company_id", "company-123")
        .is("deleted_at", null)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false })
        .limit(5);

      const { text, params } = builder.compile();

      expect(text).toBe(
        'SELECT id, name FROM "projects" WHERE "company_id" = $1 AND "deleted_at" IS NULL AND "status" IN ($2, $3) ORDER BY "created_at" DESC LIMIT 5'
      );
      expect(params).toEqual(["company-123", "active", "pending"]);

      const result = await builder;
      expect(result.data).toEqual([{ id: 1, name: "Project A" }]);
      expect(result.error).toBeNull();
      expect(mockQuery).toHaveBeenCalledWith(text, params);
    });

    it("handles single() and maybeSingle()", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res1 = await new QueryBuilder("projects").select("*").single();
      expect(res1.data).toEqual({ id: 1 });
      expect(res1.error).toBeNull();

      // Row not found in single()
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res2 = await new QueryBuilder("projects").select("*").single();
      expect(res2.data).toBeNull();
      expect(res2.error).toEqual({ message: "Row not found", code: "PGRST116" });

      // Row not found in maybeSingle()
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res3 = await new QueryBuilder("projects").select("*").maybeSingle();
      expect(res3.data).toBeNull();
      expect(res3.error).toBeNull();
    });
  });

  describe("INSERT", () => {
    it("compiles single insert correctly", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: "New Project" }] });

      const builder = new QueryBuilder("projects")
        .insert({ name: "New Project", company_id: "company-123" });

      const { text, params } = builder.compile();

      expect(text).toBe(
        'INSERT INTO "projects" ("name", "company_id") VALUES ($1, $2) RETURNING *'
      );
      expect(params).toEqual(["New Project", "company-123"]);

      const result = await builder;
      expect(result.data).toEqual([{ id: 1, name: "New Project" }]);
    });

    it("compiles bulk insert correctly", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      const builder = new QueryBuilder("projects")
        .insert([
          { name: "P1", company_id: "c1" },
          { name: "P2", company_id: "c2" },
        ]);

      const { text, params } = builder.compile();

      expect(text).toBe(
        'INSERT INTO "projects" ("name", "company_id") VALUES ($1, $2), ($3, $4) RETURNING *'
      );
      expect(params).toEqual(["P1", "c1", "P2", "c2"]);
    });
  });

  describe("UPDATE", () => {
    it("compiles update with filters correctly", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: "Updated" }] });

      const builder = new QueryBuilder("projects")
        .update({ name: "Updated" })
        .eq("id", "proj-123");

      const { text, params } = builder.compile();

      expect(text).toBe(
        'UPDATE "projects" SET "name" = $1 WHERE "id" = $2 RETURNING *'
      );
      expect(params).toEqual(["Updated", "proj-123"]);

      const result = await builder;
      expect(result.data).toEqual([{ id: 1, name: "Updated" }]);
    });
  });

  describe("UPSERT", () => {
    it("compiles upsert for profiles with user_id on conflict target", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: "user-1" }] });

      const builder = new QueryBuilder("profiles")
        .upsert({ user_id: "user-1", full_name: "John Doe" });

      const { text, params } = builder.compile();

      expect(text).toBe(
        'INSERT INTO "profiles" ("user_id", "full_name") VALUES ($1, $2) ON CONFLICT ("user_id") DO UPDATE SET "full_name" = EXCLUDED."full_name" RETURNING *'
      );
      expect(params).toEqual(["user-1", "John Doe"]);
    });

    it("compiles upsert for tenant_feature_flags with multi conflict target", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const builder = new QueryBuilder("tenant_feature_flags")
        .upsert({ company_id: "comp-1", flag: "chat", enabled: true });

      const { text, params } = builder.compile();

      expect(text).toBe(
        'INSERT INTO "tenant_feature_flags" ("company_id", "flag", "enabled") VALUES ($1, $2, $3) ON CONFLICT ("company_id", "flag") DO UPDATE SET "enabled" = EXCLUDED."enabled" RETURNING *'
      );
      expect(params).toEqual(["comp-1", "chat", true]);
    });
  });

  describe("DELETE", () => {
    it("compiles delete with filters correctly", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const builder = new QueryBuilder("projects")
        .delete()
        .eq("id", "proj-123");

      const { text, params } = builder.compile();

      expect(text).toBe('DELETE FROM "projects" WHERE "id" = $1 RETURNING *');
      expect(params).toEqual(["proj-123"]);
    });
  });
});

describe("NeonCompatClient", () => {
  let mockContext: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockContext = {
      cookies: {
        get: vi.fn(),
      },
    };
  });

  describe("auth.getSession()", () => {
    it("returns null session when cookie is missing", async () => {
      mockContext.cookies.get.mockReturnValueOnce(undefined);

      const client = new NeonCompatClient(mockContext);
      const { data, error } = await client.auth.getSession();

      expect(data.session).toBeNull();
      expect(error).toBeNull();
    });

    it("verifies and queries session successfully when cookie is valid", async () => {
      mockContext.cookies.get.mockReturnValueOnce({ value: "valid-token" });
      mockVerifySession.mockResolvedValueOnce({ userId: "user-123", email: "test@example.com", role: "authenticated" });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: "user-123", email: "test@example.com" }],
      });

      const client = new NeonCompatClient(mockContext);
      const { data, error } = await client.auth.getSession();

      expect(error).toBeNull();
      expect(data.session).not.toBeNull();
      expect(data.session?.user).toEqual({
        id: "user-123",
        email: "test@example.com",
        role: "authenticated",
      });
      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT id, email, email_confirmed_at FROM auth.users WHERE id = $1",
        ["user-123"]
      );
    });

    it("returns null session if user is not found in database", async () => {
      mockContext.cookies.get.mockReturnValueOnce({ value: "valid-token" });
      mockVerifySession.mockResolvedValueOnce({ userId: "user-123", email: "test@example.com", role: "authenticated" });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const client = new NeonCompatClient(mockContext);
      const { data, error } = await client.auth.getSession();

      expect(data.session).toBeNull();
      expect(error).toBeNull();
    });
  });

  describe("auth.getUser()", () => {
    it("gets user successfully with explicit JWT", async () => {
      mockVerifySession.mockResolvedValueOnce({ userId: "user-123", email: "test@example.com", role: "authenticated" });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: "user-123", email: "test@example.com" }],
      });

      const client = new NeonCompatClient(mockContext);
      const { data, error } = await client.auth.getUser("explicit-jwt");

      expect(error).toBeNull();
      expect(data.user).toEqual({
        id: "user-123",
        email: "test@example.com",
        role: "authenticated",
      });
      expect(mockVerifySession).toHaveBeenCalledWith("explicit-jwt");
    });
  });

  describe("Virtual RLS Injection", () => {
    it("should automatically inject user_id filter for personal resources in B2C flow", async () => {
      mockContext.cookies.get.mockReturnValueOnce({ value: "valid-token" });
      mockVerifySession.mockResolvedValueOnce({ userId: "user-123", email: "test@example.com" });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: "P1" }] });

      const client = new NeonCompatClient(mockContext);
      const result = await client.from("projects").select("*").execute();

      expect(result.data).toEqual([{ id: 1, name: "P1" }]);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM "projects" WHERE "user_id" = $1',
        ["user-123"]
      );
    });

    it("should not inject user_id filter if company_id B2B filter is active", async () => {
      mockContext.cookies.get.mockReturnValueOnce({ value: "valid-token" });
      mockVerifySession.mockResolvedValueOnce({ userId: "user-123", email: "test@example.com" });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: "P1" }] });

      const client = new NeonCompatClient(mockContext);
      await client.from("projects").select("*").eq("company_id", "company-xyz").execute();

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM "projects" WHERE "company_id" = $1',
        ["company-xyz"]
      );
    });
  });
});
