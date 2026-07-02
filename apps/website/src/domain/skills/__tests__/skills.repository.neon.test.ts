import { describe, it, expect, vi, beforeEach } from "vitest"
import { Effect } from "effect"
import { makeNeonSkillsRepository } from "../skills.repository.neon"

const mockQuery = vi.fn()
vi.mock("@/lib/neon/client", () => ({
  query: (...args: any[]) => mockQuery(...args),
}))

const mockGetCurrentUserId = vi.fn()
vi.mock("@/lib/neon/session", () => ({
  getCurrentUserId: (...args: any[]) => mockGetCurrentUserId(...args),
}))

describe("makeNeonSkillsRepository", () => {
  let mockContext: any

  beforeEach(() => {
    vi.resetAllMocks()
    mockContext = {
      cookies: {
        get: vi.fn(),
      },
    }
  })

  describe("createSkill", () => {
    it("returns TSkill on successful creation", async () => {
      mockGetCurrentUserId.mockResolvedValueOnce("user-123")
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: "skill-1",
          name: "JavaScript",
          description: "JS Programming",
          body: "console.log('hello')",
          category: "programming",
          user_id: "user-123",
          company_id: null,
          created_at: "2026-06-25T00:00:00.000Z",
          updated_at: "2026-06-25T00:00:00.000Z",
        }],
      })

      const repo = makeNeonSkillsRepository(mockContext)
      const result = await Effect.runPromise(
        repo.createSkill("JavaScript", "JS Programming", "console.log('hello')", "programming", null)
      )

      expect(result.id).toBe("skill-1")
      expect(result.name).toBe("JavaScript")
      expect(result.userId).toBe("user-123")
      expect(result.companyId).toBeNull()
      expect(mockGetCurrentUserId).toHaveBeenCalledWith(mockContext)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO skills"),
        ["JavaScript", "JS Programming", "console.log('hello')", "programming", "user-123", null]
      )
    })

    it("throws UnauthorizedError when session is missing", async () => {
      mockGetCurrentUserId.mockRejectedValueOnce(new Error("NO_TOKEN"))

      const repo = makeNeonSkillsRepository(mockContext)
      const result = await Effect.runPromise(
        Effect.flip(repo.createSkill("JS", "desc", "body", "cat", null))
      )

      expect(result._tag).toBe("UnauthorizedError")
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it("throws SkillCreationError when database query fails", async () => {
      mockGetCurrentUserId.mockResolvedValueOnce("user-123")
      mockQuery.mockRejectedValueOnce(new Error("DB error"))

      const repo = makeNeonSkillsRepository(mockContext)
      const result = await Effect.runPromise(
        Effect.flip(repo.createSkill("JS", "desc", "body", "cat", null))
      )

      expect(result._tag).toBe("SkillCreationError")
    })
  })

  describe("getSkills", () => {
    it("returns all skills without company scoping", async () => {
      mockGetCurrentUserId.mockResolvedValueOnce("user-123")
      mockQuery.mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          {
            id: "skill-1",
            name: "Skill A",
            description: "Desc A",
            body: "Body A",
            category: "Cat A",
            user_id: "user-123",
            company_id: null,
            created_at: "2026-06-25T00:00:00.000Z",
            updated_at: "2026-06-25T00:00:00.000Z",
          },
          {
            id: "skill-2",
            name: "Skill B",
            description: "Desc B",
            body: "Body B",
            category: "Cat B",
            user_id: "user-123",
            company_id: null,
            created_at: "2026-06-24T00:00:00.000Z",
            updated_at: "2026-06-24T00:00:00.000Z",
          },
        ],
      })

      const repo = makeNeonSkillsRepository(mockContext)
      const result = await Effect.runPromise(repo.getSkills(null))

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe("skill-1")
      expect(result[1].id).toBe("skill-2")
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE company_id IS NULL")
      )
    })

    it("returns skills with company scoping when companyId is provided", async () => {
      mockGetCurrentUserId.mockResolvedValueOnce("user-123")
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "skill-3",
            name: "Company Skill",
            description: "Desc C",
            body: "Body C",
            category: "Cat C",
            user_id: "user-123",
            company_id: "comp-99",
            created_at: "2026-06-25T00:00:00.000Z",
            updated_at: "2026-06-25T00:00:00.000Z",
          },
        ],
      })

      const repo = makeNeonSkillsRepository(mockContext)
      const result = await Effect.runPromise(repo.getSkills("comp-99"))

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("skill-3")
      expect(result[0].companyId).toBe("comp-99")
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE company_id = $1"),
        ["comp-99"]
      )
    })

    it("throws UnauthorizedError when session is invalid", async () => {
      mockGetCurrentUserId.mockRejectedValueOnce(new Error("INVALID_SESSION"))

      const repo = makeNeonSkillsRepository(mockContext)
      const result = await Effect.runPromise(Effect.flip(repo.getSkills(null)))

      expect(result._tag).toBe("UnauthorizedError")
    })
  })
})
