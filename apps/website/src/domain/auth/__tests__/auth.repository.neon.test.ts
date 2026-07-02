import { describe, it, expect, vi, beforeEach } from "vitest"
import { Effect } from "effect"
import { makeNeonAuthRepository } from "../auth.repository.neon"

// Mock the neon query client
const mockQuery = vi.fn()
vi.mock("@/lib/neon/client", () => ({
  query: (...args: any[]) => mockQuery(...args),
}))

// Mock the auth session helpers
const mockHashPassword = vi.fn()
const mockComparePassword = vi.fn()
const mockSignSession = vi.fn()
const mockVerifySession = vi.fn()
vi.mock("@/lib/auth/session", () => ({
  hashPassword: (...args: any[]) => mockHashPassword(...args),
  comparePassword: (...args: any[]) => mockComparePassword(...args),
  signSession: (...args: any[]) => mockSignSession(...args),
  verifySession: (...args: any[]) => mockVerifySession(...args),
}))

describe("makeNeonAuthRepository", () => {
  let mockContext: any

  beforeEach(() => {
    vi.resetAllMocks()
    mockContext = {
      cookies: {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      },
    }
  })

  describe("signUp", () => {
    it("returns TAuthResult and sets cookie on success", async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] }) // Pre-check
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "user-123", email: "test@example.com", email_confirmed_at: "2026-06-25T00:00:00.000Z" }],
      }) // Insert
      mockHashPassword.mockResolvedValueOnce("hashed_password")
      mockSignSession.mockResolvedValueOnce("token-abc")

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(repo.signUp("test@example.com", "password"))

      expect(result.user.id).toBe("user-123")
      expect(result.user.email).toBe("test@example.com")
      expect(result.session.id).toBe("token-abc")
      expect(mockContext.cookies.set).toHaveBeenCalledWith("tenang-session", "token-abc", expect.any(Object))
    })

    it("fails when email already exists", async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "user-123" }] }) // Pre-check existing

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(Effect.flip(repo.signUp("test@example.com", "password")))

      expect(result._tag).toBe("EmailAlreadyRegisteredError")
    })
  })

  describe("signIn", () => {
    it("returns TAuthResult on successful login", async () => {
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "user-123", email: "test@example.com", encrypted_password: "hashed_password", email_confirmed_at: null }],
      })
      mockComparePassword.mockResolvedValueOnce(true)
      mockSignSession.mockResolvedValueOnce("token-abc")

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(repo.signIn("test@example.com", "password"))

      expect(result.user.id).toBe("user-123")
      expect(mockContext.cookies.set).toHaveBeenCalledWith("tenang-session", "token-abc", expect.any(Object))
    })

    it("fails on invalid password", async () => {
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "user-123", email: "test@example.com", encrypted_password: "hashed_password" }],
      })
      mockComparePassword.mockResolvedValueOnce(false)

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(Effect.flip(repo.signIn("test@example.com", "wrong_password")))

      expect(result._tag).toBe("InvalidCredentialsError")
    })

    it("fails when user does not exist", async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(Effect.flip(repo.signIn("nonexistent@example.com", "password")))

      expect(result._tag).toBe("InvalidCredentialsError")
    })
  })

  describe("signOut", () => {
    it("deletes the session cookie", async () => {
      const repo = makeNeonAuthRepository(mockContext)
      await Effect.runPromise(repo.signOut())

      expect(mockContext.cookies.delete).toHaveBeenCalledWith("tenang-session", { path: "/" })
    })
  })

  describe("getSession", () => {
    it("returns session user when valid token cookie is supplied", async () => {
      mockContext.cookies.get.mockReturnValueOnce({ value: "token-abc" })
      mockVerifySession.mockResolvedValueOnce({ userId: "user-123", email: "test@example.com", role: "authenticated" })
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "user-123", email: "test@example.com", email_confirmed_at: null }],
      })

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(repo.getSession())

      expect(result).not.toBeNull()
      expect(result!.user.id).toBe("user-123")
    })

    it("returns null when session is not found in database", async () => {
      mockContext.cookies.get.mockReturnValueOnce({ value: "token-abc" })
      mockVerifySession.mockResolvedValueOnce({ userId: "user-123", email: "test@example.com", role: "authenticated" })
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(repo.getSession())

      expect(result).toBeNull()
    })

    it("returns null when no cookie is set", async () => {
      mockContext.cookies.get.mockReturnValueOnce(undefined)

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(repo.getSession())

      expect(result).toBeNull()
    })
  })
})
