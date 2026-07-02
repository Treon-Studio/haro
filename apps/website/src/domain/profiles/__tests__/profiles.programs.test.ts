import { describe, it, expect, vi } from "vitest"
import { Effect } from "effect"
import { IProfilesRepository } from "../profiles.repository"
import { getProfileProgram, updateProfileProgram } from "../profiles.programs"
import type { TProfile } from "../profiles.types"

const mockProfile: TProfile = {
  userId: "user-1",
  fullName: "John Doe",
  ageRange: "25-34",
  gender: "Male",
  pronouns: "He/Him",
  phone: "+15550199",
  language: "id",
  notificationOptIn: true,
  department: "Engineering",
  onboardingCompletedAt: "2026-06-24T00:00:00Z",
  createdAt: "2026-06-24T00:00:00Z",
  updatedAt: "2026-06-24T00:00:00Z",
}

const mockRepo = {
  getProfile: () => Effect.succeed(mockProfile),
  updateProfile: (data: any) =>
    Effect.succeed({
      ...mockProfile,
      ...data,
      onboardingCompletedAt: data.onboardingCompleted ? new Date().toISOString() : mockProfile.onboardingCompletedAt,
    }),
} satisfies IProfilesRepository["Type"]

const runWithRepo = <A, E>(effect: Effect.Effect<A, E, IProfilesRepository>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provideService(IProfilesRepository, mockRepo)))

describe("getProfileProgram", () => {
  it("retrieves current user profile", async () => {
    const result = await runWithRepo(getProfileProgram())
    expect(result.user_id).toBe("user-1")
    expect(result.full_name).toBe("John Doe")
    expect(result.age_range).toBe("25-34")
    expect(result.department).toBe("Engineering")
  })
})

describe("updateProfileProgram", () => {
  it("validates and updates profile fields", async () => {
    const result = await runWithRepo(
      updateProfileProgram({
        fullName: "Jane Doe",
        ageRange: "35-44",
        department: "Marketing",
      }),
    )
    expect(result.full_name).toBe("Jane Doe")
    expect(result.age_range).toBe("35-44")
    expect(result.department).toBe("Marketing")
  })

  it("fails on invalid age range format option", async () => {
    await expect(
      runWithRepo(
        updateProfileProgram({
          ageRange: "not-an-age-range",
        }),
      ),
    ).rejects.toThrow()
  })
})
