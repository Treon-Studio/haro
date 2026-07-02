import { Effect, pipe } from "effect"
import { Schema } from "@effect/schema"
import { createHash } from "crypto"
import { IInvitationsRepository } from "./invitations.repository"
import { CreateInvitationSchema, VerifyInvitationSchema, AcceptInvitationSchema } from "./invitations.schemas"
import { toInvitationDto } from "./invitations.types"
import type { TInvitationDto } from "./invitations.types"
import { ValidationError } from "@/shared/errors/application.errors"
import {
  InvitationCreationError,
  InvitationFetchError,
  InvitationValidationError,
  InvitationAcceptError,
  UnauthorizedError,
} from "./invitations.errors"

export type InvitationsProgramError =
  | InvitationCreationError
  | InvitationFetchError
  | InvitationValidationError
  | InvitationAcceptError
  | UnauthorizedError
  | ValidationError

// Synchronous SHA-256 hashing helper compatible with Node and Cloudflare Workers
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export const createInvitationProgram = (body: unknown): Effect.Effect<
  TInvitationDto & { readonly raw_token: string },
  InvitationsProgramError,
  IInvitationsRepository
> =>
  pipe(
    Schema.decodeUnknown(CreateInvitationSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ companyId, email, role }) =>
      pipe(
        IInvitationsRepository,
        Effect.flatMap((repo) => {
          const rawToken = crypto.randomUUID()
          const tokenHash = hashToken(rawToken)
          // Expiration set to 24 hours per PRD
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

          return pipe(
            repo.createInvitation(companyId, email, role, tokenHash, expiresAt),
            Effect.map((inv) => ({
              ...toInvitationDto(inv),
              raw_token: rawToken,
            })),
          )
        }),
      ),
    ),
  )

export const getInvitationsProgram = (
  companyId: string,
): Effect.Effect<
  readonly TInvitationDto[],
  InvitationsProgramError,
  IInvitationsRepository
> =>
  pipe(
    IInvitationsRepository,
    Effect.flatMap((repo) => repo.getInvitations(companyId)),
    Effect.map((invitations) => invitations.map(toInvitationDto)),
  )

export const verifyInvitationTokenProgram = (
  token: string,
): Effect.Effect<
  TInvitationDto,
  InvitationsProgramError,
  IInvitationsRepository
> =>
  pipe(
    IInvitationsRepository,
    Effect.flatMap((repo) => {
      const tokenHash = hashToken(token)
      return repo.verifyInvitation(tokenHash)
    }),
    Effect.map(toInvitationDto),
  )

export const acceptInvitationProgram = (
  body: unknown,
): Effect.Effect<
  TInvitationDto,
  InvitationsProgramError,
  IInvitationsRepository
> =>
  pipe(
    Schema.decodeUnknown(AcceptInvitationSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ token, userId }) =>
      pipe(
        IInvitationsRepository,
        Effect.flatMap((repo) => {
          const tokenHash = hashToken(token)
          return pipe(
            repo.verifyInvitation(tokenHash),
            Effect.flatMap((invitation) => repo.acceptInvitation(invitation.id, userId)),
          )
        }),
        Effect.map(toInvitationDto),
      ),
    ),
  )

export const revokeInvitationProgram = (
  id: string,
): Effect.Effect<
  void,
  InvitationsProgramError,
  IInvitationsRepository
> =>
  pipe(
    IInvitationsRepository,
    Effect.flatMap((repo) => repo.revokeInvitation(id)),
  )

// Helper to parse simple CSV data
function parseCsv(csvText: string): { email: string; role: "owner" | "admin" | "member" }[] {
  const lines = csvText.split("\n")
  const results: { email: string; role: "owner" | "admin" | "member" }[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("email")) continue // Skip header or empty

    const parts = trimmed.split(",")
    const email = parts[0]?.trim() || ""
    const rawRole = parts[1]?.trim()?.toLowerCase() || "member"
    const role = (rawRole === "owner" || rawRole === "admin") ? rawRole : "member"

    if (email) {
      results.push({ email, role })
    }
  }

  return results
}

// Preview CSV uploads (dry-run) for company administrators (ONB-9)
export const previewBulkInviteProgram = (
  companyId: string,
  csvText: string,
): Effect.Effect<
  {
    total_count: number
    preview_rows: { email: string; role: string; valid: boolean; error?: string }[]
    anomalies_count: number
  },
  InvitationsProgramError,
  never
> =>
  Effect.sync(() => {
    const rows = parseCsv(csvText)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    let anomaliesCount = 0

    const previewRows = rows.map((r) => {
      const isEmailValid = emailRegex.test(r.email)
      const error = isEmailValid ? undefined : "Format email tidak valid (e.g. user@domain.com)"
      if (!isEmailValid) anomaliesCount++

      return {
        email: r.email,
        role: r.role,
        valid: isEmailValid,
        error,
      }
    })

    return {
      total_count: rows.length,
      preview_rows: previewRows.slice(0, 10), // Return up to first 10 for UI preview
      anomalies_count: anomaliesCount,
    }
  })

// Batch invite CSV processor (ONB-3, ONB-6)
export const bulkInviteProgram = (
  companyId: string,
  csvText: string,
): Effect.Effect<
  { email: string; status: "success" | "error"; error_message?: string }[],
  InvitationsProgramError,
  IInvitationsRepository
> =>
  pipe(
    IInvitationsRepository,
    Effect.flatMap((repo) => {
      const rows = parseCsv(csvText)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      // Process rows sequentially to prevent connection exhaustion
      const effects = rows.map((row) => {
        if (!emailRegex.test(row.email)) {
          return Effect.succeed({ email: row.email, status: "error" as const, error_message: "Format email tidak valid" })
        }

        const rawToken = crypto.randomUUID()
        const tokenHash = hashToken(rawToken)
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

        return pipe(
          repo.createInvitation(companyId, row.email, row.role, tokenHash, expiresAt),
          Effect.map(() => ({ email: row.email, status: "success" as const })),
          Effect.catchAll((err) =>
            Effect.succeed({ email: row.email, status: "error" as const, error_message: err.message })
          ),
        )
      })

      return Effect.all(effects)
    }),
  )
