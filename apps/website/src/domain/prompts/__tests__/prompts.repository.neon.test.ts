import { describe, it, expect, vi, beforeEach } from "vitest"
import { Effect } from "effect"
import { makeNeonPromptsRepository } from "../prompts.repository.neon"

const mockQuery = vi.fn()
vi.mock("@/lib/neon/client", () => ({
  query: (...args: any[]) => mockQuery(...args),
}))

const mockGetCurrentUserId = vi.fn()
vi.mock("@/lib/neon/session", () => ({
  getCurrentUserId: (...args: any[]) => mockGetCurrentUserId(...args),
}))

describe("makeNeonPromptsRepository", () => {
  let mockContext: any

  beforeEach(() => {
    vi.resetAllMocks()
    mockContext = {
      cookies: {
        get: vi.fn(),
      },
    }
  })

  describe("createPrompt", () => {
    it("returns TPrompt on successful creation", async () => {
      mockGetCurrentUserId.mockResolvedValueOnce("user-123")
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: "prompt-1",
          name: "Test Prompt",
          category: "Testing",
          snippet: "Write a test",
          author_name: "Author",
          is_public: true,
          user_id: "user-123",
          company_id: null,
          created_at: "2026-06-25T00:00:00.000Z",
          updated_at: "2026-06-25T00:00:00.000Z",
        }],
      })

      const repo = makeNeonPromptsRepository(mockContext)
      const result = await Effect.runPromise(
        repo.createPrompt("Test Prompt", "Testing", "Write a test", "Author", true, null)
      )

      expect(result.id).toBe("prompt-1")
      expect(result.name).toBe("Test Prompt")
      expect(result.userId).toBe("user-123")
      expect(result.companyId).toBeNull()
      expect(mockGetCurrentUserId).toHaveBeenCalledWith(mockContext)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO prompts"),
        ["Test Prompt", "Testing", "Write a test", "Author", true, "user-123", null]
      )
    })

    it("handles optional fields correctly on creation", async () => {
      mockGetCurrentUserId.mockResolvedValueOnce("user-123")
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: "prompt-1",
          name: "Test Prompt",
          category: "Testing",
          snippet: "Write a test",
          author_name: null,
          is_public: false,
          user_id: "user-123",
          company_id: null,
          created_at: "2026-06-25T00:00:00.000Z",
          updated_at: "2026-06-25T00:00:00.000Z",
        }],
      })

      const repo = makeNeonPromptsRepository(mockContext)
      // Call with only required arguments
      const result = await Effect.runPromise(
        repo.createPrompt("Test Prompt", "Testing", "Write a test")
      )

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO prompts"),
        ["Test Prompt", "Testing", "Write a test", null, false, "user-123", null]
      )
      expect(result.authorName).toBeNull()
      expect(result.isPublic).toBe(false)
    })

    it("throws UnauthorizedError when session is missing", async () => {
      mockGetCurrentUserId.mockRejectedValueOnce(new Error("NO_TOKEN"))

      const repo = makeNeonPromptsRepository(mockContext)
      const result = await Effect.runPromise(
        Effect.flip(repo.createPrompt("Name", "Cat", "Snippet"))
      )

      expect(result._tag).toBe("UnauthorizedError")
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it("throws PromptCreationError when database query fails", async () => {
      mockGetCurrentUserId.mockResolvedValueOnce("user-123")
      mockQuery.mockRejectedValueOnce(new Error("DB error"))

      const repo = makeNeonPromptsRepository(mockContext)
      const result = await Effect.runPromise(
        Effect.flip(repo.createPrompt("Name", "Cat", "Snippet"))
      )

      expect(result._tag).toBe("PromptCreationError")
    })
  })

  describe("getPrompts", () => {
    it("returns all prompts without company scoping", async () => {
      mockGetCurrentUserId.mockResolvedValueOnce("user-123")
      mockQuery.mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          {
            id: "prompt-1",
            name: "Prompt A",
            category: "Cat A",
            snippet: "Snippet A",
            author_name: null,
            is_public: false,
            user_id: "user-123",
            company_id: null,
            created_at: "2026-06-25T00:00:00.000Z",
            updated_at: "2026-06-25T00:00:00.000Z",
          },
        ],
      })

      const repo = makeNeonPromptsRepository(mockContext)
      const result = await Effect.runPromise(repo.getPrompts(null))

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("prompt-1")
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE company_id IS NULL")
      )
    })

    it("returns prompts with company scoping when companyId is provided", async () => {
      mockGetCurrentUserId.mockResolvedValueOnce("user-123")
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "prompt-3",
            name: "Company Prompt",
            category: "Cat C",
            snippet: "Snippet C",
            author_name: null,
            is_public: false,
            user_id: "user-123",
            company_id: "comp-99",
            created_at: "2026-06-25T00:00:00.000Z",
            updated_at: "2026-06-25T00:00:00.000Z",
          },
        ],
      })

      const repo = makeNeonPromptsRepository(mockContext)
      const result = await Effect.runPromise(repo.getPrompts("comp-99"))

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("prompt-3")
      expect(result[0].companyId).toBe("comp-99")
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE company_id = $1"),
        ["comp-99"]
      )
    })

    it("throws UnauthorizedError when session is invalid", async () => {
      mockGetCurrentUserId.mockRejectedValueOnce(new Error("INVALID_SESSION"))

      const repo = makeNeonPromptsRepository(mockContext)
      const result = await Effect.runPromise(Effect.flip(repo.getPrompts(null)))

      expect(result._tag).toBe("UnauthorizedError")
    })
  })
})
