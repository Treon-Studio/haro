import { Context, Effect } from "effect"
import type { TRiskFlag, TEscalationCase } from "./safety.types"
import { SafetyFetchError, SafetyUpdateError, UnauthorizedError } from "./safety.errors"

export class ISafetyRepository extends Context.Tag("ISafetyRepository")<
  ISafetyRepository,
  {
    readonly flagRisk: (
      userId: string,
      companyId: string,
      sessionId: string,
      tier: "standard" | "critical",
      summary: string,
      trigger: string,
    ) => Effect.Effect<TRiskFlag, SafetyUpdateError | UnauthorizedError>

    readonly getEscalationCases: () => Effect.Effect<readonly TEscalationCase[], SafetyFetchError | UnauthorizedError>

    readonly assignCase: (
      caseId: string,
      assigneeId: string,
    ) => Effect.Effect<TEscalationCase, SafetyUpdateError | UnauthorizedError>

    readonly logFollowupAttempt: (
      caseId: string,
      notes: string,
    ) => Effect.Effect<TEscalationCase, SafetyUpdateError | UnauthorizedError>

    readonly resolveCase: (
      caseId: string,
      outcome: string,
      notes: string,
    ) => Effect.Effect<TEscalationCase, SafetyUpdateError | UnauthorizedError>
  }
> () {}
