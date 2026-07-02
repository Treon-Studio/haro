import { Context, Effect } from "effect"
import { AnalyticsFetchError, UnauthorizedError } from "./analytics.errors"

export class IAnalyticsRepository extends Context.Tag("IAnalyticsRepository")<
  IAnalyticsRepository,
  {
    readonly getCompanyMemberCount: (companyId: string) => Effect.Effect<number, AnalyticsFetchError | UnauthorizedError>
    readonly getDailyActiveUsers: (companyId: string, limitDays: number) => Effect.Effect<readonly { date: string; active_users: number }[], AnalyticsFetchError | UnauthorizedError>
    readonly getTotalSessionsCount: (companyId: string, limitDays: number) => Effect.Effect<number, AnalyticsFetchError | UnauthorizedError>
  }
> () {}
