import { Effect, pipe } from "effect"
import { ISafetyRepository } from "./safety.repository"
import { SafetyFetchError, SafetyUpdateError, UnauthorizedError } from "./safety.errors"
import { toRiskFlagDto, toEscalationCaseDto } from "./safety.types"
import type { TRiskFlagDto, TEscalationCaseDto } from "./safety.types"

export type SafetyProgramError = SafetyFetchError | SafetyUpdateError | UnauthorizedError

export const flagRiskProgram = (
  userId: string,
  companyId: string,
  sessionId: string,
  tier: "standard" | "critical",
  summary: string,
  trigger: string,
): Effect.Effect<TRiskFlagDto, SafetyProgramError, ISafetyRepository> =>
  pipe(
    ISafetyRepository,
    Effect.flatMap((repo) => repo.flagRisk(userId, companyId, sessionId, tier, summary, trigger)),
    Effect.map(toRiskFlagDto),
  )

export const getEscalationCasesProgram = (): Effect.Effect<
  readonly TEscalationCaseDto[],
  SafetyProgramError,
  ISafetyRepository
> =>
  pipe(
    ISafetyRepository,
    Effect.flatMap((repo) => repo.getEscalationCases()),
    Effect.map((cases) => cases.map(toEscalationCaseDto)),
  )

export const assignCaseProgram = (
  caseId: string,
  assigneeId: string,
): Effect.Effect<TEscalationCaseDto, SafetyProgramError, ISafetyRepository> =>
  pipe(
    ISafetyRepository,
    Effect.flatMap((repo) => repo.assignCase(caseId, assigneeId)),
    Effect.map(toEscalationCaseDto),
  )

export const logFollowupAttemptProgram = (
  caseId: string,
  notes: string,
): Effect.Effect<TEscalationCaseDto, SafetyProgramError, ISafetyRepository> =>
  pipe(
    ISafetyRepository,
    Effect.flatMap((repo) => repo.logFollowupAttempt(caseId, notes)),
    Effect.map(toEscalationCaseDto),
  )

export const resolveCaseProgram = (
  caseId: string,
  outcome: string,
  notes: string,
): Effect.Effect<TEscalationCaseDto, SafetyProgramError, ISafetyRepository> =>
  pipe(
    ISafetyRepository,
    Effect.flatMap((repo) => repo.resolveCase(caseId, outcome, notes)),
    Effect.map(toEscalationCaseDto),
  )
