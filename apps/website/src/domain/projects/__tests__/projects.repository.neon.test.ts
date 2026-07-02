import { describe, it, expect, vi, beforeEach } from "vitest"
import { Effect } from "effect"
import { makeNeonProjectsRepository } from "../projects.repository.neon"

const mockQuery = vi.fn()
vi.mock("@/lib/neon/client", () => ({
  query: (...args: any[]) => mockQuery(...args),
}))

const mockGetCurrentUserId = vi.fn()
vi.mock("@/lib/neon/session", () => ({
  getCurrentUserId: (...args: any[]) => mockGetCurrentUserId(...args),
}))

describe("makeNeonProjectsRepository", () => {
  let mockContext: any

  beforeEach(() => {
    vi.resetAllMocks()
    mockContext = {
      cookies: {
        get: vi.fn(),
      },
    }
  })

  describe("createProject", () => {
    it("returns TProject on successful creation", async () => {
      mockGetCurrentUserId.mockResolvedValueOnce("user-123")
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: "proj-1",
          name: "Project Alpha",
          user_id: "user-123",
          company_id: null,
          created_at: "2026-06-25T00:00:00.000Z",
          updated_at: "2026-06-25T00:00:00.000Z",
        }],
      })

      const repo = makeNeonProjectsRepository(mockContext)
      const result = await Effect.runPromise(repo.createProject("Project Alpha", null))

      expect(result.id).toBe("proj-1")
      expect(result.name).toBe("Project Alpha")
      expect(result.userId).toBe("user-123")
      expect(result.companyId).toBeNull()
      expect(mockGetCurrentUserId).toHaveBeenCalledWith(mockContext)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO projects"),
        ["Project Alpha", "user-123", null]
      )
    })

    it("throws UnauthorizedError when session is missing", async () => {
      mockGetCurrentUserId.mockRejectedValueOnce(new Error("NO_TOKEN"))

      const repo = makeNeonProjectsRepository(mockContext)
      const result = await Effect.runPromise(Effect.flip(repo.createProject("Project Alpha", null)))

      expect(result._tag).toBe("UnauthorizedError")
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it("throws ProjectCreationError when database query fails", async () => {
      mockGetCurrentUserId.mockResolvedValueOnce("user-123")
      mockQuery.mockRejectedValueOnce(new Error("DB error"))

      const repo = makeNeonProjectsRepository(mockContext)
      const result = await Effect.runPromise(Effect.flip(repo.createProject("Project Alpha", null)))

      expect(result._tag).toBe("ProjectCreationError")
    })
  })

  describe("getProjects", () => {
    it("returns all projects without company scoping", async () => {
      mockGetCurrentUserId.mockResolvedValueOnce("user-123")
      mockQuery.mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          {
            id: "proj-1",
            name: "Project A",
            user_id: "user-123",
            company_id: null,
            created_at: "2026-06-25T00:00:00.000Z",
            updated_at: "2026-06-25T00:00:00.000Z",
          },
          {
            id: "proj-2",
            name: "Project B",
            user_id: "user-123",
            company_id: null,
            created_at: "2026-06-24T00:00:00.000Z",
            updated_at: "2026-06-24T00:00:00.000Z",
          },
        ],
      })

      const repo = makeNeonProjectsRepository(mockContext)
      const result = await Effect.runPromise(repo.getProjects(null))

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe("proj-1")
      expect(result[1].id).toBe("proj-2")
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE company_id IS NULL")
      )
    })

    it("returns projects with company scoping when companyId is provided", async () => {
      mockGetCurrentUserId.mockResolvedValueOnce("user-123")
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "proj-3",
            name: "Company Project",
            user_id: "user-123",
            company_id: "comp-99",
            created_at: "2026-06-25T00:00:00.000Z",
            updated_at: "2026-06-25T00:00:00.000Z",
          },
        ],
      })

      const repo = makeNeonProjectsRepository(mockContext)
      const result = await Effect.runPromise(repo.getProjects("comp-99"))

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("proj-3")
      expect(result[0].companyId).toBe("comp-99")
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE company_id = $1"),
        ["comp-99"]
      )
    })

    it("throws UnauthorizedError when session is invalid", async () => {
      mockGetCurrentUserId.mockRejectedValueOnce(new Error("INVALID_SESSION"))

      const repo = makeNeonProjectsRepository(mockContext)
      const result = await Effect.runPromise(Effect.flip(repo.getProjects(null)))

      expect(result._tag).toBe("UnauthorizedError")
    })
  })
})
