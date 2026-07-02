import { describe, it, expect } from "vitest"
import { toUserDto, toAuthDto } from "../auth.dto"
import type { TUser, TAuthResult } from "../auth.types"

const mockUser: TUser = {
  id: "user-1" as never,
  email: "user@example.com",
  fullName: "John Doe",
  avatarUrl: "https://example.com/avatar.jpg",
  emailVerifiedAt: "2024-01-01T00:00:00Z",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
}

const mockAuthResult: TAuthResult = {
  user: mockUser,
  session: {
    id: "session-1" as never,
    userId: "user-1" as never,
    expiresAt: "2024-12-31T00:00:00Z",
    createdAt: "2024-01-01T00:00:00Z",
  },
}

describe("toUserDto", () => {
  it("maps TUser to TUserDto with snake_case keys", () => {
    const dto = toUserDto(mockUser)
    expect(dto).toEqual({
      id: "user-1",
      email: "user@example.com",
      full_name: "John Doe",
      avatar_url: "https://example.com/avatar.jpg",
      email_verified_at: "2024-01-01T00:00:00Z",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    })
  })

  it("handles null optional fields", () => {
    const user = { ...mockUser, avatarUrl: null, emailVerifiedAt: null }
    const dto = toUserDto(user)
    expect(dto.avatar_url).toBeNull()
    expect(dto.email_verified_at).toBeNull()
  })
})

describe("toAuthDto", () => {
  it("maps TAuthResult to TAuthDto with nested snake_case", () => {
    const dto = toAuthDto(mockAuthResult)
    expect(dto).toEqual({
      user: {
        id: "user-1",
        email: "user@example.com",
        full_name: "John Doe",
        avatar_url: "https://example.com/avatar.jpg",
        email_verified_at: "2024-01-01T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      session: {
        id: "session-1",
        user_id: "user-1",
        expires_at: "2024-12-31T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
      },
    })
  })

  it("preserves empty strings in session", () => {
    const emptySession: TAuthResult = {
      user: mockUser,
      session: { id: "" as never, userId: "" as never, expiresAt: "", createdAt: "" },
    }
    const dto = toAuthDto(emptySession)
    expect(dto.session).toEqual({
      id: "",
      user_id: "",
      expires_at: "",
      created_at: "",
    })
  })
})
