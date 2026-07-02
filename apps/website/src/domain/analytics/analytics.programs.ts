import { Effect, pipe } from "effect"
import { IAnalyticsRepository } from "./analytics.repository"
import { toAnalyticsDto } from "./analytics.types"
import type { TAnalyticsDto } from "./analytics.types"
import { AnalyticsFetchError, UnauthorizedError } from "./analytics.errors"

export type AnalyticsProgramError = AnalyticsFetchError | UnauthorizedError

export const getCompanyAnalyticsProgram = (
  companyId: string,
): Effect.Effect<TAnalyticsDto, AnalyticsProgramError, IAnalyticsRepository> =>
  pipe(
    IAnalyticsRepository,
    Effect.flatMap((repo) =>
      pipe(
        repo.getCompanyMemberCount(companyId),
        Effect.flatMap((memberCount) => {
          // Hard-stop HIPAA Privacy Guard (Choice A)
          if (memberCount < 5) {
            return Effect.succeed({
              totalMembers: memberCount,
              totalSessions: 0,
              dauHistory: [],
              isPrivacyProtected: true,
            })
          }

          return pipe(
            repo.getTotalSessionsCount(companyId, 30),
            Effect.flatMap((totalSessions) =>
              pipe(
                repo.getDailyActiveUsers(companyId, 30),
                Effect.map((dauHistory) => ({
                  totalMembers: memberCount,
                  totalSessions,
                  dauHistory,
                  isPrivacyProtected: false,
                })),
              )
            ),
          )
        }),
      )
    ),
    Effect.map(toAnalyticsDto),
  )
