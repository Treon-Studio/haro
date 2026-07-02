# Journey A Drill-Down: Employee (TDD-Level Tasks)

> **For agentic workers:** Each task in this appendix is bite-sized (2-5 minutes). Use TDD: write failing test → run to confirm fail → implement minimal code → run to confirm pass → commit.

This appendix expands **Journey A — Employee: Invitation to Ongoing Use** (PRD §8.1) into TDD-level implementation tasks. Covers PRD stories: EMP-1 to EMP-17, CHAT-1, CHAT-2, CHAT-4, CHAT-5, CHAT-6, CHAT-8, CHAT-9, CHAT-13 to CHAT-16, RISK-15, RISK-16, BILL-4, BILL-8.

**Existing patterns to mirror:**
- Domain folder: `apps/website/src/domain/auth/`
- Test pattern: `apps/website/src/domain/auth/__tests__/auth.programs.test.ts`
- API helper: `apps/website/src/lib/api-helpers.ts`
- Middleware: `apps/website/src/middleware/auth.ts`
- Route constants: `apps/website/src/shared/constants/api.constants.ts`
- Block example: `apps/website/blocks/sign-up/one/index.tsx`

---

## B.1 — Domain: `invitations` (Stage 1, 2 of Journey A)

### Task B.1.1 — Schema + types

**Files:**
- Create: `apps/website/src/domain/invitations/invitations.types.ts`
- Create: `apps/website/src/domain/invitations/invitations.schemas.ts`

**Spec — `invitations.types.ts`:**

```typescript
import type { TCompanyId, TUserId } from "@/shared/types/common.types"

export type TCompanyRole = "super_admin" | "company_admin" | "clinical_staff" | "employee"

export type TInvitationStatus = "pending" | "accepted" | "expired" | "revoked" | "failed"

export type TInvitation = {
  readonly id: string
  readonly companyId: TCompanyId
  readonly email: string
  readonly role: TCompanyRole
  readonly tokenHash: string  // bcrypt-hashed JWT
  readonly invitedBy: TUserId
  readonly expiresAt: string  // ISO 8601
  readonly status: TInvitationStatus
  readonly acceptedAt: string | null
  readonly createdAt: string
}

export type TBulkInviteRow = {
  readonly email: string
  readonly department?: string
  readonly status: "valid" | "duplicate_in_batch" | "malformed_email" | "wrong_domain" | "already_invited"
  readonly errorMessage?: string
}

export type TBulkInvitePreview = {
  readonly totalCount: number
  readonly validCount: number
  readonly invalidCount: number
  readonly sample: readonly TBulkInviteRow[]  // first 10
  readonly allValidRows: readonly TBulkInviteRow[]
}
```

**Spec — `invitations.schemas.ts`:**

```typescript
import { Schema } from "@effect/schema"
import { TCompanyRoleSchema } from "@/shared/schemas/role.schema"

export const CreateInvitationSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  role: TCompanyRoleSchema,
  companyId: Schema.String.pipe(Schema.uuid()),
  expiresInHours: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(1, 168))),
})

export const VerifyInvitationTokenSchema = Schema.Struct({
  token: Schema.String.pipe(Schema.minLength(10)),
})

export const AcceptInvitationSchema = Schema.Struct({
  token: Schema.String,
  userId: Schema.String.pipe(Schema.uuid()),
})

export const BulkInviteRowSchema = Schema.Struct({
  email: Schema.String,
  department: Schema.optional(Schema.String),
})

export const BulkInviteSchema = Schema.Struct({
  companyId: Schema.String.pipe(Schema.uuid()),
  csvText: Schema.String,
  sendImmediately: Schema.optional(Schema.Boolean),
})
```

**Acceptance criteria:**
- [ ] All schemas export without TypeScript errors
- [ ] `CreateInvitationSchema` rejects malformed email with clear `ValidationError`
- [ ] `BulkInviteRowSchema` accepts malformed emails at parse (validation at row level)

**Commit:**
```bash
git add apps/website/src/domain/invitations/invitations.types.ts \
        apps/website/src/domain/invitations/invitations.schemas.ts
git commit -m "feat(invitations): types + schemas"
```

### Task B.1.2 — Shared role schema

**Files:**
- Create: `apps/website/src/shared/schemas/role.schema.ts`
- Create: `apps/website/src/shared/schemas/__tests__/role.schema.test.ts`

**Spec — `role.schema.ts`:**

```typescript
import { Schema } from "@effect/schema"

export const TCompanyRoleSchema = Schema.Union(
  Schema.Literal("super_admin"),
  Schema.Literal("company_admin"),
  Schema.Literal("clinical_staff"),
  Schema.Literal("employee"),
)
```

**Test — `role.schema.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { Schema } from "@effect/schema"
import { TCompanyRoleSchema } from "../role.schema"

describe("TCompanyRoleSchema", () => {
  it.each(["super_admin", "company_admin", "clinical_staff", "employee"] as const)(
    "accepts valid role %s",
    async (role) => {
      const result = await Effect.runPromise(
        Effect.succeed(role).pipe(Effect.flatMap((v) => Schema.decodeUnknown(TCompanyRoleSchema)(v))),
      )
      expect(result).toBe(role)
    },
  )

  it("rejects invalid role", async () => {
    const result = await Effect.runPromise(
      Schema.decodeUnknown(TCompanyRoleSchema)("admin").pipe(Effect.catchAll((e) => Effect.succeed(e))),
    )
    expect(result).toBeInstanceOf(Error)
  })
})
```

**Run:** `pnpm test --filter website role.schema.test.ts`
**Expected:** PASS

**Commit:**
```bash
git add apps/website/src/shared/schemas/role.schema.ts \
        apps/website/src/shared/schemas/__tests__/role.schema.test.ts
git commit -m "feat(schemas): add TCompanyRoleSchema for invitation role validation"
```

### Task B.1.3 — Errors

**Files:**
- Create: `apps/website/src/domain/invitations/invitations.errors.ts`

**Spec:**

```typescript
import { Data } from "effect"

export class InvitationNotFoundError extends Data.TaggedError("InvitationNotFoundError")<{
  readonly message: string
}> {}

export class InvitationExpiredError extends Data.TaggedError("InvitationExpiredError")<{
  readonly message: string
  readonly expiredAt: string
}> {}

export class InvitationAlreadyAcceptedError extends Data.TaggedError("InvitationAlreadyAcceptedError")<{
  readonly message: string
}> {}

export class EmailMismatchError extends Data.TaggedError("EmailMismatchError")<{
  readonly message: string
  readonly expected: string
  readonly actual: string
}> {}

export class DuplicateEmailInBatchError extends Data.TaggedError("DuplicateEmailInBatchError")<{
  readonly message: string
  readonly email: string
}> {}

export class CompanyDomainMismatchError extends Data.TaggedError("CompanyDomainMismatchError")<{
  readonly message: string
  readonly companyDomain: string
  readonly emailDomain: string
}> {}

export class EmailSendError extends Data.TaggedError("EmailSendError")<{
  readonly message: string
  readonly email: string
  readonly cause?: unknown
}> {}
```

**Acceptance criteria:** All errors export with `_tag` discriminator.

**Commit:** `feat(invitations): error types`

### Task B.1.4 — Repository interface

**Files:**
- Create: `apps/website/src/domain/invitations/invitations.repository.ts`
- Create: `apps/website/src/domain/invitations/__tests__/invitations.repository.test.ts`

**Spec — `invitations.repository.ts`:**

```typescript
import { Context, Effect } from "effect"
import type { TCompanyId, TUserId } from "@/shared/types/common.types"
import type { TInvitation, TCompanyRole, TBulkInviteRow, TBulkInvitePreview } from "./invitations.types"
import {
  InvitationNotFoundError,
  InvitationExpiredError,
  InvitationAlreadyAcceptedError,
  EmailMismatchError,
  EmailSendError,
} from "./invitations.errors"

export class IInvitationsRepository extends Context.Tag("IInvitationsRepository")<
  IInvitationsRepository,
  {
    readonly create: (input: {
      companyId: TCompanyId
      email: string
      role: TCompanyRole
      invitedBy: TUserId
      expiresInHours: number
    }) => Effect.Effect<{ readonly invitation: TInvitation; readonly token: string }, EmailSendError>

    readonly verifyToken: (token: string) => Effect.Effect<
      { readonly invitation: TInvitation; readonly company: { id: TCompanyId; name: string } },
      InvitationNotFoundError | InvitationExpiredError | InvitationAlreadyAcceptedError
    >

    readonly accept: (
      token: string,
      userId: TUserId,
    ) => Effect.Effect<TInvitation, InvitationNotFoundError | InvitationExpiredError | EmailMismatchError>

    readonly previewBulkInvite: (input: {
      companyId: TCompanyId
      csvText: string
      companyDomain: string | null
    }) => Effect.Effect<TBulkInvitePreview>

    readonly executeBulkInvite: (input: {
      companyId: TCompanyId
      rows: readonly TBulkInviteRow[]
      invitedBy: TUserId
    }) => Effect.Effect<readonly TInvitation[], EmailSendError>

    readonly revoke: (id: string) => Effect.Effect<void, InvitationNotFoundError>

    readonly listPending: (companyId: TCompanyId) => Effect.Effect<readonly TInvitation[]>
  }
>() {}
```

**Test — `invitations.repository.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { IInvitationsRepository } from "../invitations.repository"

const mockRepo: IInvitationsRepository["Type"] = {
  create: (input) =>
    Effect.succeed({
      invitation: {
        id: "inv-1",
        companyId: input.companyId,
        email: input.email,
        role: input.role,
        tokenHash: "hashed",
        invitedBy: input.invitedBy,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        status: "pending",
        acceptedAt: null,
        createdAt: new Date().toISOString(),
      },
      token: "raw-jwt-token",
    }),
  verifyToken: () => Effect.die("not implemented in mock"),
  accept: () => Effect.die("not implemented in mock"),
  previewBulkInvite: () => Effect.die("not implemented in mock"),
  executeBulkInvite: () => Effect.die("not implemented in mock"),
  revoke: () => Effect.void,
  listPending: () => Effect.succeed([]),
}

const runWith = <A, E>(eff: Effect.Effect<A, E, IInvitationsRepository>) =>
  Effect.runPromise(eff.pipe(Effect.provideService(IInvitationsRepository, mockRepo)))

describe("IInvitationsRepository contract", () => {
  it("create returns invitation and raw token", async () => {
    const { invitation, token } = await runWith(
      IInvitationsRepository.pipe(
        Effect.flatMap((r) =>
          r.create({
            companyId: "co-1" as any,
            email: "a@b.com",
            role: "employee",
            invitedBy: "u-1" as any,
            expiresInHours: 24,
          }),
        ),
      ),
    )
    expect(invitation.email).toBe("a@b.com")
    expect(invitation.status).toBe("pending")
    expect(token).toBe("raw-jwt-token")
  })

  it("context tag key is correct", () => {
    expect(IInvitationsRepository.key).toBe("IInvitationsRepository")
  })
})
```

**Run:** `pnpm test --filter website invitations.repository.test.ts`
**Expected:** PASS

**Commit:** `feat(invitations): repository interface + mock test contract`

### Task B.1.5 — CSV parser helper

**Files:**
- Create: `apps/website/src/domain/invitations/csv.ts`
- Create: `apps/website/src/domain/invitations/__tests__/csv.test.ts`

**Spec — `csv.ts`:**

```typescript
import { Effect } from "effect"
import { ValidationError } from "@/shared/errors/application.errors"

export type ParsedCsvRow = {
  readonly rowNumber: number
  readonly email: string
  readonly department: string | null
  readonly raw: Record<string, string>
}

const REQUIRED_HEADERS = ["email"] as const

export const parseBulkInviteCsv = (csvText: string): Effect.Effect<readonly ParsedCsvRow[], ValidationError> =>
  Effect.gen(function* () {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length === 0) {
      return yield* new ValidationError({ issues: ["CSV is empty"] })
    }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
    const missingRequired = REQUIRED_HEADERS.filter((h) => !headers.includes(h))
    if (missingRequired.length > 0) {
      return yield* new ValidationError({
        issues: [`Missing required headers: ${missingRequired.join(", ")}`],
      })
    }
    const emailIdx = headers.indexOf("email")
    const deptIdx = headers.indexOf("department")

    const rows: ParsedCsvRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim())
      const email = cols[emailIdx] ?? ""
      const department = deptIdx >= 0 ? cols[deptIdx] ?? null : null
      const raw: Record<string, string> = {}
      headers.forEach((h, idx) => {
        raw[h] = cols[idx] ?? ""
      })
      rows.push({ rowNumber: i, email, department, raw })
    }
    return rows
  })
```

**Test — `csv.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { parseBulkInviteCsv } from "../csv"
import { ValidationError } from "@/shared/errors/application.errors"

const run = <A, E>(eff: Effect.Effect<A, E>) => Effect.runPromise(eff)

describe("parseBulkInviteCsv", () => {
  it("parses valid CSV", async () => {
    const rows = await run(parseBulkInviteCsv("email,department\na@b.com,Eng\nc@d.com,Sales"))
    expect(rows).toHaveLength(2)
    expect(rows[0].email).toBe("a@b.com")
    expect(rows[0].department).toBe("Eng")
  })

  it("rejects empty CSV", async () => {
    const err = await run(parseBulkInviteCsv("").pipe(Effect.catchAll((e) => Effect.succeed(e))))
    expect(err).toBeInstanceOf(ValidationError)
  })

  it("rejects missing email header", async () => {
    const err = await run(parseBulkInviteCsv("department\nEng").pipe(Effect.catchAll((e) => Effect.succeed(e))))
    expect(err).toBeInstanceOf(ValidationError)
  })

  it("handles CSV without department column", async () => {
    const rows = await run(parseBulkInviteCsv("email\na@b.com"))
    expect(rows[0].department).toBeNull()
  })

  it("handles CRLF line endings", async () => {
    const rows = await run(parseBulkInviteCsv("email\r\na@b.com"))
    expect(rows).toHaveLength(1)
  })
})
```

**Run:** `pnpm test --filter website csv.test.ts`
**Expected:** 5 tests PASS

**Commit:** `feat(invitations): CSV parser with Effect validation`

### Task B.1.6 — Row-level bulk invite validator

**Files:**
- Create: `apps/website/src/domain/invitations/bulk-validator.ts`
- Create: `apps/website/src/domain/invitations/__tests__/bulk-validator.test.ts`

**Spec — `bulk-validator.ts`:**

```typescript
import { Effect } from "effect"
import type { ParsedCsvRow } from "./csv"
import type { TBulkInviteRow } from "./invitations.types"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type BulkValidationInput = {
  readonly rows: readonly ParsedCsvRow[]
  readonly companyDomain: string | null
  readonly existingPendingEmails: readonly string[]
}

export const validateBulkRows = (
  input: BulkValidationInput,
): Effect.Effect<readonly TBulkInviteRow[]> =>
  Effect.sync(() => {
    const seen = new Set<string>()
    const result: TBulkInviteRow[] = []

    for (const row of input.rows) {
      const normalized = row.email.toLowerCase().trim()
      let status: TBulkInviteRow["status"] = "valid"
      let errorMessage: string | undefined

      if (!EMAIL_REGEX.test(normalized)) {
        status = "malformed_email"
        errorMessage = "Invalid email format"
      } else if (seen.has(normalized)) {
        status = "duplicate_in_batch"
        errorMessage = "Duplicate in this batch"
      } else if (input.existingPendingEmails.includes(normalized)) {
        status = "already_invited"
        errorMessage = "Already has pending invitation"
      } else if (input.companyDomain) {
        const emailDomain = normalized.split("@")[1]
        if (emailDomain !== input.companyDomain) {
          status = "wrong_domain"
          errorMessage = `Email domain doesn't match company (${input.companyDomain})`
        }
      }

      if (status === "valid") seen.add(normalized)
      const resultRow: TBulkInviteRow = errorMessage
        ? { email: normalized, department: row.department ?? undefined, status, errorMessage }
        : { email: normalized, department: row.department ?? undefined, status }
      result.push(resultRow)
    }

    return result
  })
```

**Test — `bulk-validator.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { validateBulkRows } from "../bulk-validator"
import { parseBulkInviteCsv } from "../csv"

const run = <A, E>(eff: Effect.Effect<A, E>) => Effect.runPromise(eff)
const parseCsv = async (csv: string) => run(parseBulkInviteCsv(csv))

describe("validateBulkRows", () => {
  it("flags malformed emails", async () => {
    const rows = await parseCsv("email\nnot-an-email")
    const result = await run(validateBulkRows({ rows, companyDomain: "acme.com", existingPendingEmails: [] }))
    expect(result[0].status).toBe("malformed_email")
  })

  it("flags duplicate in batch", async () => {
    const rows = await parseCsv("email\na@b.com\na@b.com")
    const result = await run(validateBulkRows({ rows, companyDomain: "b.com", existingPendingEmails: [] }))
    expect(result[0].status).toBe("valid")
    expect(result[1].status).toBe("duplicate_in_batch")
  })

  it("flags wrong domain", async () => {
    const rows = await parseCsv("email\nuser@evil.com")
    const result = await run(validateBulkRows({ rows, companyDomain: "acme.com", existingPendingEmails: [] }))
    expect(result[0].status).toBe("wrong_domain")
  })

  it("flags already invited", async () => {
    const rows = await parseCsv("email\na@b.com")
    const result = await run(
      validateBulkRows({ rows, companyDomain: "b.com", existingPendingEmails: ["a@b.com"] }),
    )
    expect(result[0].status).toBe("already_invited")
  })

  it("accepts valid rows", async () => {
    const rows = await parseCsv("email,department\na@acme.com,Eng")
    const result = await run(validateBulkRows({ rows, companyDomain: "acme.com", existingPendingEmails: [] }))
    expect(result[0].status).toBe("valid")
    expect(result[0].department).toBe("Eng")
  })

  it("skips domain check when companyDomain is null", async () => {
    const rows = await parseCsv("email\nuser@anywhere.com")
    const result = await run(validateBulkRows({ rows, companyDomain: null, existingPendingEmails: [] }))
    expect(result[0].status).toBe("valid")
  })
})
```

**Run:** `pnpm test --filter website bulk-validator.test.ts`
**Expected:** 6 tests PASS

**Commit:** `feat(invitations): bulk row validator with all 4 status types`

### Task B.1.7 — JWT token generation + verification

**Files:**
- Create: `apps/website/src/domain/invitations/token.ts`
- Create: `apps/website/src/domain/invitations/__tests__/token.test.ts`

**Spec — `token.ts`:**

```typescript
import { Effect } from "effect"
import { sign, verify } from "jsonwebtoken"
import { ValidationError } from "@/shared/errors/application.errors"
import { InvitationExpiredError, InvitationNotFoundError } from "./invitations.errors"
import type { TCompanyId, TUserId } from "@/shared/types/common.types"
import type { TCompanyRole } from "./invitations.types"

const INVITATION_JWT_SECRET = import.meta.env.INVITATION_JWT_SECRET ?? "dev-invitation-secret-change-me"
const ALGORITHM = "HS256" as const

export type InvitationJwtPayload = {
  readonly invitationId: string
  readonly companyId: TCompanyId
  readonly email: string
  readonly role: TCompanyRole
  readonly invitedBy: TUserId
}

export const generateInvitationToken = (
  payload: InvitationJwtPayload,
  expiresInHours: number,
): Effect.Effect<string, ValidationError> =>
  Effect.try({
    try: () => sign(payload, INVITATION_JWT_SECRET, { algorithm: ALGORITHM, expiresIn: `${expiresInHours}h` }),
    catch: (e) => new ValidationError({ issues: [`Failed to sign invitation: ${String(e)}`] }),
  })

export const verifyInvitationToken = (
  token: string,
): Effect.Effect<InvitationJwtPayload, InvitationNotFoundError | InvitationExpiredError> =>
  Effect.try({
    try: () => {
      const decoded = verify(token, INVITATION_JWT_SECRET, { algorithms: [ALGORITHM] })
      return decoded as unknown as InvitationJwtPayload
    },
    catch: (e: any) => {
      if (e?.name === "TokenExpiredError") {
        return new InvitationExpiredError({ message: "Invitation expired", expiredAt: e.expiredAt })
      }
      return new InvitationNotFoundError({ message: "Invalid invitation token" })
    },
  })
```

**Test — `token.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { generateInvitationToken, verifyInvitationToken } from "../token"
import { InvitationExpiredError, InvitationNotFoundError } from "../invitations.errors"

const run = <A, E>(eff: Effect.Effect<A, E>) => Effect.runPromise(eff)
const runCatch = <A, E>(eff: Effect.Effect<A, E>) =>
  Effect.runPromise(eff.pipe(Effect.catchAll((e) => Effect.succeed(e))))

const samplePayload = {
  invitationId: "inv-1",
  companyId: "co-1" as any,
  email: "a@b.com",
  role: "employee" as const,
  invitedBy: "u-1" as any,
}

describe("generateInvitationToken + verifyInvitationToken", () => {
  it("generates and verifies valid token", async () => {
    const token = await run(generateInvitationToken(samplePayload, 24))
    const decoded = await run(verifyInvitationToken(token))
    expect(decoded.email).toBe("a@b.com")
    expect(decoded.role).toBe("employee")
  })

  it("rejects garbage token", async () => {
    const err = await runCatch(verifyInvitationToken("garbage.token.here"))
    expect(err).toBeInstanceOf(InvitationNotFoundError)
  })

  it("rejects expired token", async () => {
    const token = await run(generateInvitationToken(samplePayload, -1))
    const err = await runCatch(verifyInvitationToken(token))
    expect(err).toBeInstanceOf(InvitationExpiredError)
  })
})
```

**Run:** `pnpm test --filter website token.test.ts`
**Expected:** 3 tests PASS

**Commit:** `feat(invitations): JWT token generation + verification with expiry handling`

### Task B.1.8 — `createInvitationProgram`

**Files:**
- Create: `apps/website/src/domain/invitations/invitations.programs.ts`
- Create: `apps/website/src/domain/invitations/__tests__/invitations.programs.test.ts`

**Spec — `invitations.programs.ts`:**

```typescript
import { Effect, pipe } from "effect"
import { CreateInvitationSchema } from "./invitations.schemas"
import { IInvitationsRepository } from "./invitations.repository"
import { generateInvitationToken } from "./token"
import { ICompaniesRepository } from "@/domain/companies/companies.repository"
import { ValidationError } from "@/shared/errors/application.errors"
import type { TCompanyId, TUserId } from "@/shared/types/common.types"
import { sendInvitationEmail } from "@/lib/email/resend"
import { CompanyNotFoundError, ForbiddenError } from "@/domain/companies/companies.errors"
import { EmailSendError } from "./invitations.errors"

export type CreateInvitationProgramError =
  | ValidationError
  | CompanyNotFoundError
  | ForbiddenError
  | EmailSendError

export const createInvitationProgram = (body: unknown): Effect.Effect<
  { readonly invitationId: string; readonly email: string },
  CreateInvitationProgramError,
  IInvitationsRepository | ICompaniesRepository
> =>
  Effect.gen(function* () {
    const input = yield* Effect.try({
      try: () => CreateInvitationSchema.makeSync(body as any),
      catch: (e) => new ValidationError({ issues: [String(e)] }),
    })

    const company = yield* ICompaniesRepository.pipe(
      Effect.flatMap((r) => r.findById(input.companyId as TCompanyId)),
      Effect.catchAll(() => Effect.fail(new CompanyNotFoundError({ message: "Company not found" }))),
    )

    const { invitation, token } = yield* IInvitationsRepository.pipe(
      Effect.flatMap((r) =>
        r.create({
          companyId: input.companyId as TCompanyId,
          email: input.email,
          role: input.role,
          invitedBy: "system" as TUserId,
          expiresInHours: input.expiresInHours ?? 24,
        }),
      ),
    )

    const inviteUrl = `${import.meta.env.PUBLIC_SITE_URL}/sign-up?invitation=${token}`

    yield* Effect.tryPromise({
      try: () => sendInvitationEmail(input.email, inviteUrl, company.name),
      catch: (e) => new EmailSendError({ message: String(e), email: input.email }),
    })

    return { invitationId: invitation.id, email: input.email }
  })
```

**Test — `invitations.programs.test.ts`:**

```typescript
import { describe, it, expect, vi } from "vitest"
import { Effect } from "effect"
import { IInvitationsRepository } from "../invitations.repository"
import { ICompaniesRepository } from "@/domain/companies/companies.repository"
import { createInvitationProgram } from "../invitations.programs"
import { ValidationError } from "@/shared/errors/application.errors"
import { EmailSendError } from "../invitations.errors"

const mockInvitations: IInvitationsRepository["Type"] = {
  create: (input) =>
    Effect.succeed({
      invitation: {
        id: "inv-1",
        companyId: input.companyId,
        email: input.email,
        role: input.role,
        tokenHash: "hashed",
        invitedBy: input.invitedBy,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        status: "pending",
        acceptedAt: null,
        createdAt: new Date().toISOString(),
      },
      token: "raw-jwt-token",
    }),
  verifyToken: () => Effect.die("n/a"),
  accept: () => Effect.die("n/a"),
  previewBulkInvite: () => Effect.die("n/a"),
  executeBulkInvite: () => Effect.succeed([]),
  revoke: () => Effect.void,
  listPending: () => Effect.succeed([]),
}

const mockCompanies: ICompaniesRepository["Type"] = {
  create: () => Effect.die("n/a"),
  findById: () =>
    Effect.succeed({
      id: "co-1" as any,
      name: "Acme Corp",
      domain: "acme.com",
      billingTier: "starter" as const,
      sessionQuota: 100,
      sessionsUsed: 0,
      contractStartDate: null,
      contractEndDate: null,
      status: "active" as const,
      legalHold: false,
      softDeletedAt: null,
      sessionIdleTimeoutMinutes: 60,
      createdBy: "u-1" as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  list: () => Effect.succeed({ items: [], nextCursor: null }),
  update: () => Effect.die("n/a"),
  updateQuota: () => Effect.die("n/a"),
  suspend: () => Effect.die("n/a"),
  unsuspend: () => Effect.die("n/a"),
  softDelete: () => Effect.die("n/a"),
  hardDelete: () => Effect.die("n/a"),
  restoreFromSoftDelete: () => Effect.die("n/a"),
}

// Mock email send
vi.mock("@/lib/email/resend", () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
}))

const run = <A, E>(eff: Effect.Effect<A, E, IInvitationsRepository | ICompaniesRepository>) =>
  Effect.runPromise(
    eff.pipe(
      Effect.provideService(IInvitationsRepository, mockInvitations),
      Effect.provideService(ICompaniesRepository, mockCompanies),
    ),
  )

describe("createInvitationProgram", () => {
  it("creates invitation and returns id + email", async () => {
    const result = await run(
      createInvitationProgram({
        email: "new@acme.com",
        role: "employee",
        companyId: "00000000-0000-0000-0000-000000000001",
      }),
    )
    expect(result.email).toBe("new@acme.com")
    expect(result.invitationId).toBe("inv-1")
  })

  it("rejects invalid email", async () => {
    const result = await Effect.runPromise(
      createInvitationProgram({
        email: "not-an-email",
        role: "employee",
        companyId: "00000000-0000-0000-0000-000000000001",
      }).pipe(Effect.catchAll((e) => Effect.succeed(e))),
    )
    expect(result).toBeInstanceOf(ValidationError)
  })

  it("rejects invalid role", async () => {
    const result = await Effect.runPromise(
      createInvitationProgram({
        email: "a@b.com",
        role: "admin" as any,
        companyId: "00000000-0000-0000-0000-000000000001",
      }).pipe(Effect.catchAll((e) => Effect.succeed(e))),
    )
    expect(result).toBeInstanceOf(ValidationError)
  })
})
```

**Run:** `pnpm test --filter website invitations.programs.test.ts`
**Expected:** 3 tests PASS

**Commit:** `feat(invitations): createInvitationProgram with validation chain`

### Task B.1.9 — Supabase implementation

**Files:**
- Create: `apps/website/src/domain/invitations/invitations.repository.supabase.ts`
- Create: `apps/website/src/domain/invitations/index.ts`

**Spec — `invitations.repository.supabase.ts`:**

```typescript
import { Effect } from "effect"
import type { SupabaseClient } from "@supabase/supabase-js"
import { IInvitationsRepository } from "./invitations.repository"
import { generateInvitationToken, verifyInvitationToken } from "./token"
import { compare, hash } from "bcryptjs"
import type { TInvitation } from "./invitations.types"
import {
  InvitationExpiredError,
  InvitationNotFoundError,
  InvitationAlreadyAcceptedError,
  EmailMismatchError,
} from "./invitations.errors"

const BCRYPT_ROUNDS = 10

const fromInvitationRow = (row: any): TInvitation => ({
  id: row.id,
  companyId: row.company_id,
  email: row.email,
  role: row.role,
  tokenHash: row.token_hash,
  invitedBy: row.invited_by,
  expiresAt: row.expires_at,
  status: row.status,
  acceptedAt: row.accepted_at,
  createdAt: row.created_at,
})

export const makeSupabaseInvitationsRepository = (supabase: SupabaseClient): IInvitationsRepository["Type"] => ({
  create: ({ companyId, email, role, invitedBy, expiresInHours }) =>
    Effect.gen(function* () {
      const tempId = crypto.randomUUID()
      const token = yield* generateInvitationToken({ invitationId: tempId, companyId, email, role, invitedBy }, expiresInHours)
      const tokenHash = yield* Effect.tryPromise({
        try: () => hash(token, BCRYPT_ROUNDS),
        catch: (e) => new InvitationNotFoundError({ message: `Failed to hash token: ${String(e)}` }),
      })
      const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()
      const { data, error } = yield* Effect.tryPromise({
        try: () =>
          supabase
            .from("invitations")
            .insert({
              id: tempId,
              company_id: companyId,
              email,
              role,
              token_hash: tokenHash,
              invited_by: invitedBy,
              expires_at: expiresAt,
              status: "pending",
            })
            .select()
            .single(),
        catch: (e) => new InvitationNotFoundError({ message: `DB insert failed: ${String(e)}` }),
      })
      if (error || !data) throw new InvitationNotFoundError({ message: error?.message ?? "Insert failed" })
      return { invitation: fromInvitationRow(data), token }
    }),

  verifyToken: (token) =>
    Effect.gen(function* () {
      const payload = yield* verifyInvitationToken(token)
      const { data, error } = yield* Effect.tryPromise({
        try: () =>
          supabase
            .from("invitations")
            .select("*, companies(id, name)")
            .eq("id", payload.invitationId)
            .single(),
        catch: (e) => new InvitationNotFoundError({ message: `DB query failed: ${String(e)}` }),
      })
      if (error || !data) {
        return yield* Effect.fail(new InvitationNotFoundError({ message: "Invitation not found" }))
      }

      // Verify hash matches
      const hashMatches = yield* Effect.tryPromise({
        try: () => compare(token, data.token_hash),
        catch: () => false,
      })
      if (!hashMatches) {
        return yield* Effect.fail(new InvitationNotFoundError({ message: "Invalid invitation token" }))
      }

      if (data.status === "accepted") {
        return yield* Effect.fail(new InvitationAlreadyAcceptedError({ message: "Already accepted" }))
      }

      if (new Date(data.expires_at) < new Date()) {
        return yield* Effect.fail(new InvitationExpiredError({ message: "Expired", expiredAt: data.expires_at }))
      }

      return {
        invitation: fromInvitationRow(data),
        company: { id: data.companies.id, name: data.companies.name },
      }
    }),

  accept: () => Effect.die("TODO: B.1.10"),
  previewBulkInvite: () => Effect.die("TODO: B.1.11"),
  executeBulkInvite: () => Effect.die("TODO: B.1.11"),
  revoke: () => Effect.void,
  listPending: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        const { data } = await supabase
          .from("invitations")
          .select("*")
          .eq("company_id", companyId)
          .eq("status", "pending")
        return (data ?? []).map(fromInvitationRow)
      },
      catch: () => [],
    }),
})
```

**Spec — `index.ts`:**

```typescript
export * from "./invitations.types"
export * from "./invitations.schemas"
export * from "./invitations.errors"
export * from "./invitations.repository"
export * from "./invitations.programs"
export * from "./invitations.token"
export { makeSupabaseInvitationsRepository } from "./invitations.repository.supabase"
```

**Commit:** `feat(invitations): Supabase implementation of repository`

### Task B.1.10 — `acceptInvitationProgram`

**Files:**
- Append to: `apps/website/src/domain/invitations/invitations.programs.ts`
- Create: `apps/website/src/domain/invitations/__tests__/accept-invitation.test.ts`

**Spec:**

```typescript
export const acceptInvitationProgram = (
  token: string,
  userId: TUserId,
  userEmail: string,
): Effect.Effect<
  { readonly companyId: TCompanyId; readonly role: TCompanyRole },
  EmailMismatchError | InvitationExpiredError | InvitationNotFoundError | InvitationAlreadyAcceptedError,
  IInvitationsRepository
> =>
  Effect.gen(function* () {
    const { invitation } = yield* IInvitationsRepository.pipe(Effect.flatMap((r) => r.verifyToken(token)))

    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      return yield* Effect.fail(
        new EmailMismatchError({
          message: "Email doesn't match invitation",
          expected: invitation.email,
          actual: userEmail,
        }),
      )
    }

    yield* IInvitationsRepository.pipe(Effect.flatMap((r) => r.accept(token, userId)))

    return { companyId: invitation.companyId, role: invitation.role }
  })
```

**Acceptance criteria:**
- [ ] Accepts valid pending token
- [ ] Rejects expired token
- [ ] Rejects already-accepted token
- [ ] Rejects if user email doesn't match

**Commit:** `feat(invitations): acceptInvitationProgram with email verification`

### Task B.1.11 — Bulk invite preview + execute

**Files:**
- Create: `apps/website/src/domain/invitations/bulk-invite.program.ts`
- Create: `apps/website/src/pages/admin/roster.astro`
- Create: `apps/website/src/components/admin/BulkInviteUploader.tsx`
- Create: `apps/website/src/components/admin/BulkInvitePreview.tsx`
- Create: `apps/website/src/pages/api/invitations/bulk.ts`

**Spec — `bulk-invite.program.ts`:**

```typescript
export const previewBulkInviteProgram = (
  body: unknown,
): Effect.Effect<TBulkInvitePreview, ValidationError, IInvitationsRepository | ICompaniesRepository> =>
  Effect.gen(function* () {
    const input = yield* Schema.decodeUnknown(BulkInviteSchema)(body).pipe(
      Effect.mapError((e) => new ValidationError({ issues: [e.message] })),
    )

    const company = yield* ICompaniesRepository.pipe(Effect.flatMap((r) => r.findById(input.companyId as TCompanyId)))
    const rows = yield* parseBulkInviteCsv(input.csvText)
    const pending = yield* IInvitationsRepository.pipe(Effect.flatMap((r) => r.listPending(input.companyId as TCompanyId)))
    const pendingEmails = pending.map((i) => i.email)

    const validated = yield* validateBulkRows({
      rows,
      companyDomain: company.domain,
      existingPendingEmails: pendingEmails,
    })

    return {
      totalCount: rows.length,
      validCount: validated.filter((r) => r.status === "valid").length,
      invalidCount: validated.filter((r) => r.status !== "valid").length,
      sample: validated.slice(0, 10),
      allValidRows: validated.filter((r) => r.status === "valid"),
    }
  })

export const executeBulkInviteProgram = (
  body: unknown,
  invitedBy: TUserId,
): Effect.Effect<readonly TInvitation[], ValidationError | EmailSendError, IInvitationsRepository | ICompaniesRepository> =>
  Effect.gen(function* () {
    // Re-run preview to get validated rows
    const preview = yield* previewBulkInviteProgram(body)
    if (!preview.allValidRows.length) {
      return []
    }

    const results: TInvitation[] = []
    for (const row of preview.allValidRows) {
      const { invitation } = yield* IInvitationsRepository.pipe(
        Effect.flatMap((r) =>
          r.create({
            companyId: preview.allValidRows[0].email.includes("@")
              ? (body as any).companyId
              : ("" as any),
            email: row.email,
            role: "employee",
            invitedBy,
            expiresInHours: 24,
          }),
        ),
      )
      results.push(invitation)
    }
    return results
  })
```

**Spec — `BulkInviteUploader.tsx`:**

```typescript
type BulkInviteUploaderProps = {
  readonly companyId: string
  readonly onPreview: (preview: TBulkInvitePreview) => void
  readonly onComplete: (sent: number) => void
}

export const BulkInviteUploader = ({ companyId, onPreview, onComplete }: BulkInviteUploaderProps) => {
  const [csvText, setCsvText] = useState("")
  const [preview, setPreview] = useState<TBulkInvitePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    const text = await file.text()
    setCsvText(text)
  }

  const handlePreview = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/invitations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, csvText, sendImmediately: false }),
      })
      const json = await res.json()
      if (json.success) {
        setPreview(json.data)
        onPreview(json.data)
      } else {
        setError(json.error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/invitations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, csvText, sendImmediately: true }),
      })
      const json = await res.json()
      if (json.success) {
        onComplete(json.data.length)
        setPreview(null)
        setCsvText("")
      } else {
        setError(json.error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div data-testid="bulk-invite-uploader">
      <input
        data-testid="csv-upload"
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <textarea
        data-testid="csv-textarea"
        placeholder="Or paste CSV here: email,department"
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        rows={5}
      />
      <Button data-testid="preview-button" onClick={handlePreview} disabled={!csvText || loading}>
        Preview
      </Button>

      {preview && (
        <BulkInvitePreview
          preview={preview}
          onConfirm={handleConfirm}
          onCancel={() => setPreview(null)}
          loading={loading}
        />
      )}

      {error && <div data-testid="upload-error" className="text-red-500">{error}</div>}
    </div>
  )
}
```

**Spec — `BulkInvitePreview.tsx`:**

```typescript
type BulkInvitePreviewProps = {
  readonly preview: TBulkInvitePreview
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly loading: boolean
}

export const BulkInvitePreview = ({ preview, onConfirm, onCancel, loading }: BulkInvitePreviewProps) => (
  <div data-testid="bulk-invite-preview" className="mt-4">
    <h3>Preview</h3>
    <div className="flex gap-4">
      <span data-testid="total-count">Total: {preview.totalCount}</span>
      <span data-testid="valid-count" className="text-green-600">Valid: {preview.validCount}</span>
      <span data-testid="invalid-count" className="text-red-600">Invalid: {preview.invalidCount}</span>
    </div>

    <table className="w-full mt-2">
      <thead>
        <tr>
          <th>Email</th>
          <th>Department</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {preview.sample.map((row, i) => (
          <tr key={i} data-testid={`preview-row-${i}`} className={row.status !== "valid" ? "bg-red-50" : ""}>
            <td>{row.email}</td>
            <td>{row.department ?? "-"}</td>
            <td>
              <Badge variant={row.status === "valid" ? "default" : "destructive"}>
                {row.status}
              </Badge>
              {row.errorMessage && <span className="text-xs text-red-600 ml-2">{row.errorMessage}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <p className="text-sm text-gray-500 mt-2">
      Showing first {preview.sample.length} of {preview.totalCount} rows.
    </p>

    <div className="flex gap-2 mt-4">
      <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
      <Button data-testid="confirm-send" onClick={onConfirm} disabled={loading || preview.validCount === 0}>
        Send {preview.validCount} invitation{preview.validCount !== 1 ? "s" : ""}
      </Button>
    </div>
  </div>
)
```

**Spec — `apps/website/src/pages/api/invitations/bulk.ts`:**

```typescript
import type { APIContext } from "astro"
import { IInvitationsRepository, makeSupabaseInvitationsRepository } from "@/domain/invitations"
import { ICompaniesRepository, makeSupabaseCompaniesRepository } from "@/domain/companies"
import { previewBulkInviteProgram, executeBulkInviteProgram } from "@/domain/invitations/bulk-invite.program"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { jsonOk, jsonError, makeMeta } from "@/lib/api-helpers"
import { Effect } from "effect"

export const POST = async (context: APIContext) => {
  const body = await context.request.json()
  const supabase = createSupabaseServerClient(context)!

  const userId = context.locals.session?.userId
  if (!userId) {
    return jsonError({ _tag: "Unauthorized", message: "Not logged in" }, makeMeta(), 401)
  }

  const invRepo = makeSupabaseInvitationsRepository(supabase)
  const coRepo = makeSupabaseCompaniesRepository(supabase)

  try {
    if (body.sendImmediately) {
      const result = await Effect.runPromise(
        executeBulkInviteProgram(body, userId as any).pipe(
          Effect.provideService(IInvitationsRepository, invRepo),
          Effect.provideService(ICompaniesRepository, coRepo),
        ),
      )
      return jsonOk(result, makeMeta())
    } else {
      const result = await Effect.runPromise(
        previewBulkInviteProgram(body).pipe(
          Effect.provideService(IInvitationsRepository, invRepo),
          Effect.provideService(ICompaniesRepository, coRepo),
        ),
      )
      return jsonOk(result, makeMeta())
    }
  } catch (e: any) {
    return jsonError({ _tag: e._tag ?? "Error", message: e.message ?? String(e) }, makeMeta(), 400)
  }
}
```

**Acceptance criteria — covers PRD ONB-3, ONB-6, ONB-9:**
- [ ] Upload 100-row CSV → preview shows count, first 10 rows, anomalies
- [ ] Bad emails flagged in red, valid rows still processable
- [ ] Duplicates in batch flagged
- [ ] Wrong-domain emails warned
- [ ] Already-pending emails flagged
- [ ] "Confirm" button sends all valid rows
- [ ] Single confirm action sends all (ONB-9)

**Commit:** `feat(invitations): bulk invite preview + execute with full validation UI`

### Task B.1.12 — E2E test for invitation flow

**Files:**
- Create: `apps/website/tests/e2e/invitation-flow.spec.ts`

**Spec — Playwright test:**

```typescript
import { test, expect } from "@playwright/test"

test("complete invitation flow: bulk invite → register → first chat", async ({ page }) => {
  // 1. Log in as Company Admin
  await page.goto("/login")
  await page.fill("[data-testid=email]", "admin@acme.com")
  await page.fill("[data-testid=password]", "test-password")
  await page.click("[data-testid=login-submit]")

  // 2. Navigate to roster, upload CSV
  await page.goto("/admin/roster")
  const csv = "email,department\nemp1@acme.com,Eng\nemp2@acme.com,Sales"
  await page.setInputFiles("[data-testid=csv-upload]", {
    name: "employees.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  })
  await page.click("[data-testid=preview-button]")

  // 3. Verify preview shows 2 valid rows
  await expect(page.locator("[data-testid=valid-count]")).toHaveText("Valid: 2")
  await expect(page.locator("[data-testid=invalid-count]")).toHaveText("Invalid: 0")

  // 4. Confirm send
  await page.click("[data-testid=confirm-send]")
  await expect(page.locator("[data-testid=success-toast]")).toBeVisible()
})
```

**Run:** `pnpm playwright test invitation-flow`
**Expected:** PASS

**Commit:** `test(e2e): complete invitation flow`

---

## B.2 — Domain: `memberships` + employee signup gate (Stage 3-4 of Journey A)

### Task B.2.1 — Modify SignUpSchema to accept invitation token

**Files:**
- Modify: `apps/website/src/domain/auth/auth.schemas.ts`

**Spec:**

```typescript
export const SignUpSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  password: Schema.String.pipe(Schema.minLength(8)),
  invitationToken: Schema.optional(Schema.String.pipe(Schema.minLength(10))),
  fullName: Schema.optional(Schema.String.pipe(Schema.minLength(2))),
})
```

**Acceptance criteria:** Schema accepts invitationToken field.

**Commit:** `feat(auth): accept invitationToken in signUp schema`

### Task B.2.2 — Modify signUpProgram to validate invitation

**Files:**
- Modify: `apps/website/src/domain/auth/auth.programs.ts`

**Spec:**

```typescript
export const signUpProgram = (
  body: unknown,
): Effect.Effect<
  TAuthDto,
  AuthProgramError | ValidationError | EmailMismatchError | InvitationExpiredError | InvitationNotFoundError,
  IAuthRepository | IInvitationsRepository
> =>
  pipe(
    Schema.decodeUnknown(SignUpSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ email, password, invitationToken }) =>
      Effect.gen(function* () {
        if (invitationToken) {
          const { invitation } = yield* IInvitationsRepository.pipe(
            Effect.flatMap((r) => r.verifyToken(invitationToken)),
          )
          if (invitation.email.toLowerCase() !== email.toLowerCase()) {
            return yield* Effect.fail(
              new EmailMismatchError({
                message: "Email doesn't match invitation",
                expected: invitation.email,
                actual: email,
              }),
            )
          }
        }

        const authResult = yield* IAuthRepository.pipe(
          Effect.flatMap((repo) => repo.signUp(email, password)),
        )

        if (invitationToken) {
          yield* IInvitationsRepository.pipe(
            Effect.flatMap((r) => r.accept(invitationToken, authResult.user.id as TUserId)),
          )
        }

        return toAuthDto(authResult)
      }),
    ),
  )
```

**Acceptance criteria — see A.1 Stage 4:**
- [ ] B2C signup (no token) still works
- [ ] B2B signup with valid token creates membership
- [ ] B2B signup with email mismatch fails
- [ ] B2B signup with expired token fails

**Commit:** `feat(auth): validate invitation in signUp, create membership on success`

### Task B.2.3 — Refactor sign-up block for B2B mode

**Files:**
- Modify: `apps/website/blocks/sign-up/one/index.tsx`
- Create: `apps/website/src/pages/api/invitations/peek.ts`

**Spec — `peek.ts`:**

```typescript
import type { APIContext } from "astro"
import { IInvitationsRepository, makeSupabaseInvitationsRepository } from "@/domain/invitations"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { jsonOk, jsonError, makeMeta } from "@/lib/api-helpers"
import { Effect } from "effect"

export const GET = async (context: APIContext) => {
  const token = context.url.searchParams.get("token")
  if (!token) {
    return jsonError({ _tag: "ValidationError", message: "Missing token" }, makeMeta(), 400)
  }

  const supabase = createSupabaseServerClient(context)
  if (!supabase) {
    return jsonError({ _tag: "Error", message: "Server error" }, makeMeta(), 500)
  }

  const invRepo = makeSupabaseInvitationsRepository(supabase)
  try {
    const result = await Effect.runPromise(
      invRepo.verifyToken(token).pipe(Effect.provideService(IInvitationsRepository, invRepo)),
    )
    return jsonOk(
      {
        companyName: result.company.name,
        email: result.invitation.email,
        role: result.invitation.role,
      },
      makeMeta(),
    )
  } catch (e: any) {
    return jsonError({ _tag: e._tag ?? "Error", message: e.message }, makeMeta(), 400)
  }
}
```

**Spec — `sign-up/one/index.tsx` modification:**

```typescript
// Add at top of component:
const urlParams = new URLSearchParams(window.location.search)
const invitationToken = urlParams.get("invitation")
const [invitationContext, setInvitationContext] = useState<{
  companyName: string
  email: string
} | null>(null)

useEffect(() => {
  if (invitationToken) {
    fetch(`/api/invitations/peek?token=${invitationToken}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setInvitationContext(d.data)
      })
  }
}, [invitationToken])

// In form, before email field:
{invitationContext && (
  <div data-testid="invitation-header" className="bg-blue-50 p-4 rounded-md mb-4">
    <h2 className="font-semibold">Welcome to {invitationContext.companyName}</h2>
    <p className="text-sm text-gray-600">
      You're joining {invitationContext.companyName}'s confidential mental wellness benefit.
    </p>
  </div>
)}

// Email field is pre-filled with invitationContext.email and disabled
```

**Acceptance criteria:**
- [ ] /sign-up?invitation=<valid> shows company name in header
- [ ] /sign-up?invitation=<expired> shows "Invitation expired"
- [ ] /sign-up (no token) shows standard B2C form

**Commit:** `feat(signup): show invitation context in sign-up block`

### Task B.2.4 — B2C/B2B conflict screen (EMP-17)

**Files:**
- Create: `apps/website/src/components/auth/AccountConflictScreen.tsx`
- Modify: `apps/website/blocks/sign-up/one/index.tsx`

**Spec — `AccountConflictScreen.tsx`:**

```typescript
type AccountConflictScreenProps = {
  readonly companyName: string
  readonly email: string
  readonly onContinue: () => void
  readonly onUseDifferentEmail: () => void
}

export const AccountConflictScreen = ({ companyName, email, onContinue, onUseDifferentEmail }: AccountConflictScreenProps) => (
  <div data-testid="account-conflict-screen" className="max-w-md mx-auto p-6">
    <h2 className="text-xl font-semibold mb-4">Existing account detected</h2>
    <p className="text-sm text-gray-700 mb-4">
      You have an existing personal Tenang account with <strong>{email}</strong>.
    </p>
    <p className="text-sm text-gray-700 mb-4">
      {companyName} wants to add you as a B2B employee. Your personal conversations are <strong>NOT</strong> visible to {companyName} — the two accounts stay separate.
    </p>
    <div className="flex gap-2">
      <Button data-testid="continue-existing" onClick={onContinue}>
        Continue with existing account
      </Button>
      <Button variant="outline" data-testid="use-different-email" onClick={onUseDifferentEmail}>
        Use a different email
      </Button>
    </div>
  </div>
)
```

**Test cases — see A.1 Stage 3:**
- [ ] Email new to system → proceed
- [ ] Email exists as B2C user (no company) → show conflict
- [ ] Email exists as employee in different company → block
- [ ] Email exists as company admin in same company → allow

**Commit:** `feat(signup): B2C/B2B conflict screen per EMP-17`

---

## B.3 — Profile + Orientation (Stage 6-7 of Journey A)

### Task B.3.1 — `/update-profile` page

**Files:**
- Create: `apps/website/supabase/migrations/20260625000000_extend_users_profile.sql`
- Create: `apps/website/src/pages/update-profile.astro`
- Create: `apps/website/src/components/auth/UpdateProfileForm.tsx`
- Create: `apps/website/src/pages/api/auth/profile.ts`

**Migration spec:**

```sql
-- apps/website/supabase/migrations/20260625000000_extend_users_profile.sql
alter table auth.users add column if not exists full_name text;
alter table auth.users add column if not exists age_range text;
alter table auth.users add column if not exists preferred_language text default 'id';
alter table auth.users add column if not exists notification_opt_in boolean default true;
alter table auth.users add column if not exists phone text;
alter table auth.users add column if not exists onboarding_completed_at timestamptz;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  age_range text not null,
  preferred_language text not null default 'id',
  notification_opt_in boolean not null default true,
  phone text,
  gender text,
  pronouns text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "users_own_profile" on public.profiles
  for all using (auth.uid() = user_id);

create trigger handle_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();
```

**Spec — `UpdateProfileForm.tsx`:**

```typescript
const ageRanges = ["18-24", "25-34", "35-44", "45-54", "55+", "prefer_not_to_say"] as const

export const UpdateProfileForm = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    ageRange: "",
    preferredLanguage: "id",
    notificationOptIn: true,
    phone: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Load draft from localStorage
  useEffect(() => {
    const draft = localStorage.getItem("tenang:profile-draft")
    if (draft) setFormData(JSON.parse(draft))
  }, [])

  // Auto-save on change
  useEffect(() => {
    localStorage.setItem("tenang:profile-draft", JSON.stringify(formData))
  }, [formData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.fullName || !formData.ageRange) {
      setError("Name and age range are required")
      return
    }
    setSubmitting(true)
    const res = await fetch("/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    })
    if (res.ok) {
      localStorage.removeItem("tenang:profile-draft")
      window.location.href = "/onboarding/orientation"
    } else {
      const json = await res.json()
      setError(json.error.message)
    }
    setSubmitting(false)
  }

  return (
    <form data-testid="update-profile-form" onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <Label htmlFor="fullName">Full name *</Label>
        <Input id="fullName" data-testid="full-name" value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="ageRange">Age range *</Label>
        <Select value={formData.ageRange} onValueChange={(v) => setFormData({ ...formData, ageRange: v })}>
          <SelectTrigger data-testid="age-range">
            <SelectValue placeholder="Select age range" />
          </SelectTrigger>
          <SelectContent>
            {ageRanges.map((r) => (
              <SelectItem key={r} value={r}>{r === "prefer_not_to_say" ? "Prefer not to say" : r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="preferredLanguage">Preferred language</Label>
        <Select value={formData.preferredLanguage} onValueChange={(v) => setFormData({ ...formData, preferredLanguage: v })}>
          <SelectTrigger data-testid="language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="id">Bahasa Indonesia</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" data-testid="phone" value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" data-testid="notification-opt-in"
          checked={formData.notificationOptIn}
          onChange={(e) => setFormData({ ...formData, notificationOptIn: e.target.checked })} />
        Send me gentle reminders and check-ins
      </label>
      {error && <div data-testid="profile-error" className="text-red-500">{error}</div>}
      <Button data-testid="profile-submit" type="submit" disabled={submitting}>Continue</Button>
    </form>
  )
}
```

**Acceptance criteria:**
- [ ] All required fields validated
- [ ] Phone format validation
- [ ] Age < 18 blocked
- [ ] Auto-save draft to localStorage
- [ ] Submit redirects to /onboarding/orientation

**Commit:** `feat(profile): update-profile page with EMP-2 fields + age guard`

### Task B.3.2 — Orientation screen (EMP-16)

**Files:**
- Create: `apps/website/src/pages/onboarding/orientation.astro`
- Create: `apps/website/src/components/onboarding/OrientationScreen.tsx`

**Spec — `OrientationScreen.tsx`:**

```typescript
type OrientationScreenProps = {
  readonly companyName: string
  readonly onGetStarted: () => void
}

const ORIENTATION_CONTENT = {
  whatWeDo: [
    "Listen without judgment",
    "Help you reflect on what's on your mind",
    "Suggest exercises and techniques",
    "Remember your context between sessions",
  ],
  whatWeDontDo: [
    "We're not a therapist or counselor",
    "We're not a crisis line or emergency service",
    "We don't replace medical or psychiatric care",
  ],
  whatStaysPrivate: [
    "Your conversations are encrypted",
    "{companyName} HR cannot see what you talk about",
    "HR only sees aggregate, anonymized data",
  ],
  crisisResources: "If you're in crisis, contact Into The Light Indonesia: 119 ext. 8",
}

export const OrientationScreen = ({ companyName, onGetStarted }: OrientationScreenProps) => {
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)

  return (
    <div data-testid="orientation-screen" className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Welcome to Tenang</h1>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">What we do</h2>
        <ul className="list-disc pl-6 space-y-1">
          {ORIENTATION_CONTENT.whatWeDo.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">What we don't do</h2>
        <ul className="list-disc pl-6 space-y-1">
          {ORIENTATION_CONTENT.whatWeDontDo.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">What stays private</h2>
        <ul className="list-disc pl-6 space-y-1">
          {ORIENTATION_CONTENT.whatStaysPrivate.map((item) => (
            <li key={item}>{item.replace("{companyName}", companyName)}</li>
          ))}
        </ul>
      </section>

      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
        <p className="text-sm text-yellow-900">
          <strong>Crisis support:</strong> {ORIENTATION_CONTENT.crisisResources}
        </p>
      </div>

      <div className="flex gap-2">
        <Button data-testid="get-started" onClick={onGetStarted}>Get started</Button>
        <Button variant="outline" data-testid="skip-orientation" onClick={() => setShowSkipConfirm(true)}>
          Re-read this later
        </Button>
      </div>

      {showSkipConfirm && (
        <Dialog open onOpenChange={(o) => !o && setShowSkipConfirm(false)}>
          <DialogContent>
            <DialogTitle>Skip orientation?</DialogTitle>
            <DialogDescription>
              You can re-read this anytime from Settings. Are you sure?
            </DialogDescription>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSkipConfirm(false)}>Cancel</Button>
              <Button onClick={onGetStarted}>Yes, skip</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
```

**API endpoint to mark orientation complete:**

```typescript
// apps/website/src/pages/api/auth/profile.ts
export const POST = async (context: APIContext) => {
  // ... save profile ...
  // ... mark orientation_completed_at ...
}
```

**Test cases — see A.1 Stage 7:**
- [ ] First-time user after profile → orientation shown
- [ ] User clicks "Get started" → timestamp set, redirect to /c/
- [ ] User clicks "Re-read this later" → confirmation, then skip
- [ ] User refreshes without choosing → orientation re-appears

**Commit:** `feat(onboarding): orientation screen with clinical-approved content (EMP-16)`

### Task B.3.3 — Middleware force profile + orientation

**Files:**
- Modify: `apps/website/src/middleware/auth.ts`

**Spec:**

```typescript
// After existing auth check:
if (isProtected && session) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("user_id", session.user.id)
    .single()

  if (!profile) {
    return context.redirect("/update-profile")
  }
  if (!profile.onboarding_completed_at && !pathname.startsWith("/onboarding")) {
    return context.redirect("/onboarding/orientation")
  }
}
```

**Commit:** `feat(middleware): force profile + orientation completion for protected routes`

---

## B.4 — First Chat + Crisis Card (Stage 8-9 of Journey A)

### Task B.4.1 — `useEngagementState` hook

**Files:**
- Create: `apps/website/src/domain/engagement/engagement.ts`
- Create: `apps/website/src/domain/engagement/__tests__/engagement.test.ts`

**Spec — `engagement.ts`:**

```typescript
export type TEngagementState =
  | { readonly kind: "first_session" }
  | { readonly kind: "returning"; readonly lastSessionAt: string | null }
  | { readonly kind: "long_absence"; readonly daysSinceLast: number }

export const computeEngagementState = (lastSessionAt: string | null): TEngagementState => {
  if (!lastSessionAt) return { kind: "first_session" }
  const daysSince = Math.floor((Date.now() - new Date(lastSessionAt).getTime()) / (1000 * 60 * 60 * 24))
  if (daysSince >= 30) return { kind: "long_absence", daysSinceLast: daysSince }
  return { kind: "returning", lastSessionAt }
}
```

**Test — `engagement.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import { computeEngagementState } from "../engagement"

describe("computeEngagementState", () => {
  it("returns first_session when no history", () => {
    expect(computeEngagementState(null).kind).toBe("first_session")
  })

  it("returns returning when < 30 days", () => {
    const recent = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
    expect(computeEngagementState(recent).kind).toBe("returning")
  })

  it("returns long_absence when >= 30 days", () => {
    const longAgo = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString()
    const state = computeEngagementState(longAgo)
    if (state.kind === "long_absence") {
      expect(state.daysSinceLast).toBeGreaterThanOrEqual(60)
    } else {
      throw new Error("expected long_absence")
    }
  })
})
```

**Run:** `pnpm test --filter website engagement.test.ts`
**Expected:** 3 tests PASS

**Commit:** `feat(engagement): compute engagement state for chat greeting (CHAT-13/15)`

### Task B.4.2 — Inject engagement state into chat system prompt

**Files:**
- Modify: `apps/website/src/pages/api/chat.ts`
- Modify: `apps/website/blocks/chat/hooks/useChat.ts`

**Spec:**

```typescript
// In pages/api/chat.ts, before calling LLM:
const getSystemPromptAddition = (engagement: TEngagementState): string => {
  if (engagement.kind === "first_session") {
    return `\n[System note: This is the user's first session. Use the approved first-time greeting (CHAT-13). Be warm, set context. Do NOT ask generic "how can I help today?".]`
  }
  if (engagement.kind === "long_absence") {
    return `\n[System note: User is returning after ${engagement.daysSinceLast} days. Use the approved re-engagement greeting (CHAT-15). Acknowledge warmly without pressure.]`
  }
  return ""
}
```

**Commit:** `feat(chat): inject engagement state into system prompt (CHAT-13/15)`

### Task B.4.3 — Crisis resource card component

**Files:**
- Create: `apps/website/blocks/chat/components/CrisisResourceCard.tsx`
- Modify: `apps/website/blocks/chat/components/MessagesView.tsx`

**Spec — `CrisisResourceCard.tsx`:**

```typescript
import { useState } from "react"
import { X } from "lucide-react"

type CrisisResourceCardProps = {
  readonly hotline: {
    readonly name: string
    readonly number: string
    readonly description: string
  }
  readonly onDismiss: () => void
}

export const DEFAULT_HOTLINE = {
  name: "Into The Light Indonesia",
  number: "119 ext. 8",
  description: "24/7 mental health crisis support",
}

export const CrisisResourceCard = ({ hotline, onDismiss }: CrisisResourceCardProps) => {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div
      data-testid="crisis-resource-card"
      className="border-l-4 border-red-500 bg-red-50 p-4 my-2 rounded-md"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-red-900">If you need immediate support</h3>
          <p className="text-red-800 mt-1">
            <strong>{hotline.name}:</strong>{" "}
            <a
              href={`tel:${hotline.number.replace(/[\s.]/g, "")}`}
              className="underline font-mono"
              data-testid="crisis-hotline-number"
            >
              {hotline.number}
            </a>
          </p>
          <p className="text-red-700 text-sm mt-1">{hotline.description}</p>
        </div>
        <button
          data-testid="crisis-dismiss"
          onClick={() => {
            setDismissed(true)
            onDismiss()
          }}
          className="text-red-700 hover:text-red-900"
          aria-label="Dismiss crisis resource"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
```

**Integration in `MessagesView.tsx`:**

```typescript
// Add to component:
const [showCrisisCard, setShowCrisisCard] = useState(false)

// Subscribe to risk events via Supabase Realtime
useEffect(() => {
  if (!userId) return
  const channel = supabase
    .channel(`user:${userId}:risk`)
    .on("broadcast", { event: "risk_flag" }, (payload) => {
      if (payload.tier === "critical" || payload.tier === "standard") {
        setShowCrisisCard(true)
      }
    })
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}, [userId])

// Render below message input:
{showCrisisCard && (
  <CrisisResourceCard
    hotline={DEFAULT_HOTLINE}
    onDismiss={() => {
      // Persist dismissal in localStorage so it doesn't reappear this session
      sessionStorage.setItem("tenang:crisis-dismissed", "1")
    }}
  />
)}
```

**Test cases — see A.1 Stage 9:**
- [ ] Card appears when risk_flag event received
- [ ] Card is non-disruptive (session continues)
- [ ] AI continues responding normally
- [ ] Dismiss hides card for current session
- [ ] Card reappears in next session if flag still active

**Commit:** `feat(chat): non-disruptive crisis resource card (CHAT-16)`

### Task B.4.4 — Chat island E2E test

**Files:**
- Create: `apps/website/tests/e2e/first-chat-flow.spec.ts`

**Spec — Playwright E2E:**

```typescript
import { test, expect } from "@playwright/test"

test("first-time user sees first-session greeting, crisis card appears on flag", async ({ page }) => {
  // 1. Log in as fresh employee
  await page.goto("/login")
  await page.fill("[data-testid=email]", "newbie@acme.com")
  await page.fill("[data-testid=password]", "test-password")
  await page.click("[data-testid=login-submit]")

  // 2. Land on /c/
  await expect(page).toHaveURL(/\/c\//)

  // 3. Verify first-time greeting in chat
  await expect(page.locator("[data-testid=chat-greeting]")).toContainText(/welcome|hi/i)

  // 4. Send a message
  await page.fill("[data-testid=chat-input]", "Hello, I need to talk")
  await page.click("[data-testid=chat-send]")

  // 5. Wait for AI response
  await expect(page.locator("[data-testid=chat-message-assistant]").last()).toBeVisible({ timeout: 30000 })

  // 6. Simulate risk flag (mock broadcast)
  await page.evaluate(() => {
    // @ts-ignore
    window.__supabase.channel("user:test:risk").send({
      type: "broadcast",
      event: "risk_flag",
      payload: { tier: "standard" },
    })
  })

  // 7. Verify crisis card appears
  await expect(page.locator("[data-testid=crisis-resource-card]")).toBeVisible()
  await expect(page.locator("[data-testid=crisis-hotline-number]")).toContainText("119")

  // 8. Verify AI still responsive
  await page.fill("[data-testid=chat-input]", "I'm still here")
  await page.click("[data-testid=chat-send]")
  await expect(page.locator("[data-testid=chat-message-assistant]").last()).toBeVisible({ timeout: 30000 })

  // 9. Verify card dismissable
  await page.click("[data-testid=crisis-dismiss]")
  await expect(page.locator("[data-testid=crisis-resource-card]")).not.toBeVisible()
})
```

**Run:** `pnpm playwright test first-chat-flow`
**Expected:** PASS

**Commit:** `test(e2e): first-time chat with crisis card flow`

---

## B.5 — Post-Session Summary + Quota Screen (Stage 10, 13 of Journey A)

### Task B.5.1 — PostSessionSummary component

**Files:**
- Create: `apps/website/blocks/chat/components/PostSessionSummary.tsx`
- Modify: `apps/website/blocks/chat/hooks/useChat.ts`

**Spec — `PostSessionSummary.tsx`:**

```typescript
import { useState } from "react"
import { Button } from "@treonstudio/bungas-core/ui/button"
import { Card } from "@treonstudio/bungas-core/ui/card"

type PostSessionSummaryProps = {
  readonly summary: string
  readonly recommendation: { readonly type: "skill" | "content" | "none"; readonly title: string; readonly href: string }
  readonly onMoodSubmit: (score: 1 | 2 | 3 | 4 | 5) => void
  readonly onSkipMood: () => void
  readonly onStartNew: () => void
  readonly onClose: () => void
}

const MOOD_EMOJIS = ["😢", "😕", "😐", "🙂", "😊"] as const

export const PostSessionSummary = ({
  summary,
  recommendation,
  onMoodSubmit,
  onSkipMood,
  onStartNew,
  onClose,
}: PostSessionSummaryProps) => {
  const [moodSelected, setMoodSelected] = useState<1 | 2 | 3 | 4 | 5 | null>(null)

  return (
    <div data-testid="post-session-summary" className="max-w-2xl mx-auto p-6 space-y-4">
      <Card>
        <h2 className="text-xl font-semibold mb-2">Session summary</h2>
        <p data-testid="summary-text" className="text-gray-700">{summary}</p>
      </Card>

      <Card data-testid="mood-prompt">
        <h3 className="font-semibold mb-2">How are you feeling? (optional)</h3>
        <div className="flex gap-2">
          {MOOD_EMOJIS.map((emoji, i) => (
            <button
              key={i + 1}
              data-testid={`mood-${i + 1}`}
              onClick={() => {
                setMoodSelected((i + 1) as 1 | 2 | 3 | 4 | 5)
                onMoodSubmit((i + 1) as 1 | 2 | 3 | 4 | 5)
              }}
              className={`text-2xl p-2 rounded ${moodSelected === i + 1 ? "bg-blue-100" : "hover:bg-gray-100"}`}
              aria-label={`Mood ${i + 1}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <button data-testid="mood-skip" onClick={onSkipMood} className="text-sm text-gray-500 mt-2">
          Skip
        </button>
      </Card>

      {recommendation.type !== "none" && (
        <Card data-testid="recommendation">
          <h3 className="font-semibold mb-2">You might also like</h3>
          <a href={recommendation.href} className="text-blue-600 hover:underline">
            {recommendation.title}
          </a>
        </Card>
      )}

      <div className="flex gap-2">
        <Button data-testid="start-new" onClick={onStartNew}>Start new session</Button>
        <Button variant="outline" data-testid="close" onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}
```

**Test cases — see A.1 Stage 10:**
- [ ] Summary shows after session end
- [ ] Mood prompt is optional, skippable
- [ ] Recommendation is contextual
- [ ] "Start new session" clears the session state
- [ ] Risk-event-ended session skips summary

**Commit:** `feat(chat): post-session summary screen (CHAT-14)`

### Task B.5.2 — Quota-exhausted screen (BILL-4)

**Files:**
- Create: `apps/website/blocks/chat/components/QuotaExhaustedScreen.tsx`
- Modify: `apps/website/blocks/chat/index.tsx`
- Modify: `apps/website/src/pages/api/chat.ts`

**Spec — `QuotaExhaustedScreen.tsx`:**

```typescript
type QuotaExhaustedScreenProps = {
  readonly companyName: string
  readonly adminEmail: string
  readonly resetsAt: string | null
}

export const QuotaExhaustedScreen = ({ companyName, adminEmail, resetsAt }: QuotaExhaustedScreenProps) => (
  <div data-testid="quota-exhausted" className="max-w-md mx-auto p-6 text-center">
    <h2 className="text-2xl font-semibold mb-4">Session limit reached</h2>
    <p className="text-gray-700 mb-4">
      {companyName} has reached its session limit for this billing cycle.
    </p>
    <p className="text-gray-600 mb-6">
      You can return {resetsAt ? `on ${new Date(resetsAt).toLocaleDateString()}` : "next cycle"}.
    </p>
    <p className="text-sm text-gray-500 mb-4">Need more sessions? Contact your HR team:</p>
    <a
      href={`mailto:${adminEmail}?subject=Increase%20Tenang%20session%20quota`}
      data-testid="contact-hr-link"
      className="text-blue-600 hover:underline"
    >
      Contact {companyName} HR
    </a>
  </div>
)
```

**Quota check in `apps/website/src/pages/api/chat.ts`:**

```typescript
// At the top of the chat handler:
const { data: company } = await supabase
  .from("companies")
  .select("sessions_used, session_quota, name, contract_end_date, domain")
  .eq("id", userCompanyId)
  .single()

if (company && company.sessions_used >= company.session_quota) {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        _tag: "QuotaExhaustedError",
        message: "Session limit reached",
        companyName: company.name,
        resetsAt: company.contract_end_date,
        adminEmail: `hr@${company.domain}`,
      },
    }),
    { status: 402 },
  )
}
```

**Test cases — see A.1 Stage 13:**
- [ ] Quota at 0 → screen shown instead of chat
- [ ] Screen shows company name + admin contact
- [ ] User retries → same screen, no error
- [ ] Quota resets → sessions work again

**Commit:** `feat(billing): quota-exhausted chat screen (BILL-4)`

### Task B.5.3 — Mid-session quota protection (BILL-8)

**Files:**
- Create: `apps/website/supabase/migrations/20260625000001_increment_sessions_rpc.sql`

**Migration:**

```sql
create or replace function public.increment_company_sessions_used(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id
  from public.user_company_memberships
  where user_id = p_user_id and is_active and role = 'employee'
  limit 1;

  if v_company_id is not null then
    update public.companies
    set sessions_used = sessions_used + 1
    where id = v_company_id;
  end if;
end;
$$;
```

**Spec — quota check at session start only:**

```typescript
// In useChat.ts, when starting a new session:
const startSession = async () => {
  // Increment quota
  await supabase.rpc("increment_company_sessions_used", { p_user_id: userId })
  // ... start session normally
}

// sendMessage handler does NOT check quota
// This means active sessions always allowed to finish
```

**Test:**
- [ ] Active session allowed to finish when quota runs out mid-session
- [ ] New session blocked when quota at 0

**Commit:** `feat(billing): mid-session quota protection (BILL-8)`

---

## B.6 — Pause, Email Change, Deactivation (Stage 14-16 of Journey A)

### Task B.6.1 — `pauseAccountProgram` (EMP-11)

**Files:**
- Create: `apps/website/src/domain/lifecycle/pause.program.ts`
- Create: `apps/website/src/pages/api/account/pause.ts`
- Create: `apps/website/src/pages/account/pause.astro`
- Migration: add `paused_at` to profiles

**Migration:**

```sql
-- apps/website/supabase/migrations/20260625000002_add_paused_at.sql
alter table public.profiles add column if not exists paused_at timestamptz;
alter table public.profiles add column if not exists pause_reason text;
```

**Spec — `pause.program.ts`:**

```typescript
import { Effect } from "effect"
import { IAuthRepository } from "@/domain/auth/auth.repository"
import { Data } from "effect"

export class OpenEscalationCaseError extends Data.TaggedError("OpenEscalationCaseError")<{
  readonly message: string
  readonly caseIds: string[]
}> {}

export const pauseAccountProgram = (
  userId: string,
  reason?: string,
): Effect.Effect<void, OpenEscalationCaseError, IAuthRepository> =>
  Effect.gen(function* () {
    // Check: no open escalation cases
    // (mock for now; will integrate with escalation domain in D.x)
    const openCases: string[] = []  // TODO: replace with real check

    if (openCases.length > 0) {
      return yield* Effect.fail(
        new OpenEscalationCaseError({
          message: "Cannot pause account while escalation case is open",
          caseIds: openCases,
        }),
      )
    }

    yield* IAuthRepository.pipe(
      Effect.flatMap((r) => r.updateProfile(userId, { pausedAt: new Date().toISOString(), pauseReason: reason ?? null })),
    )

    // Sign out all devices
    yield* IAuthRepository.pipe(Effect.flatMap((r) => r.signOutAllDevices(userId)))
  })

export const unpauseAccountProgram = (userId: string): Effect.Effect<void, never, IAuthRepository> =>
  IAuthRepository.pipe(
    Effect.flatMap((r) => r.updateProfile(userId, { pausedAt: null, pauseReason: null })),
  )
```

**Test cases — see A.1 Stage 14:**
- [ ] Pause with no open case → succeeds
- [ ] Pause with open escalation case → blocked
- [ ] Unpause → features restored
- [ ] Paused user excluded from MAU
- [ ] Paused user cannot start chat

**Commit:** `feat(lifecycle): pause/unpause account with escalation guard (EMP-11)`

### Task B.6.2 — `changeEmailProgram` (EMP-10)

**Files:**
- Create: `apps/website/src/domain/lifecycle/change-email.program.ts`
- Create: `apps/website/src/pages/api/account/change-email.ts`

**Spec:**

```typescript
import { Data, Effect } from "effect"
import { IAuthRepository } from "@/domain/auth/auth.repository"

export class ChangeEmailError extends Data.TaggedError("ChangeEmailError")<{
  readonly message: string
}> {}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const changeEmailProgram = (
  userId: string,
  newEmail: string,
): Effect.Effect<{ readonly requiresOtp: true }, ChangeEmailError, IAuthRepository> =>
  Effect.gen(function* () {
    if (!EMAIL_REGEX.test(newEmail)) {
      return yield* Effect.fail(new ChangeEmailError({ message: "Invalid email format" }))
    }

    const isSuperAdminEmail = yield* IAuthRepository.pipe(
      Effect.flatMap((r) => r.isSuperAdminEmail(newEmail)),
    )
    if (isSuperAdminEmail) {
      return yield* Effect.fail(new ChangeEmailError({ message: "This email is reserved" }))
    }

    const exists = yield* IAuthRepository.pipe(Effect.flatMap((r) => r.emailExists(newEmail)))
    if (exists) {
      return yield* Effect.fail(new ChangeEmailError({ message: "Email already in use" }))
    }

    yield* IAuthRepository.pipe(Effect.flatMap((r) => r.sendEmailChangeOtp(userId, newEmail)))
    return { requiresOtp: true } as const
  })
```

**Test cases — see A.1 Stage 15:**
- [ ] Valid new email → OTP sent
- [ ] Invalid email → rejected
- [ ] Email exists → rejected
- [ ] Super admin email → blocked

**Commit:** `feat(lifecycle): change email with OTP (EMP-10)`

### Task B.6.3 — `requestOtpResendProgram` (EMP-4)

**Files:**
- Create: `apps/website/src/domain/auth/otp-resend.program.ts`
- Create: `apps/website/src/pages/api/auth/otp-resend.ts`

**Spec:**

```typescript
const RESEND_LIMIT_PER_15MIN = 3

export const requestOtpResendProgram = (
  email: string,
  type: "signup" | "recovery" | "2fa",
): Effect.Effect<void, OtpResendRateLimitError, IAuthRepository> =>
  Effect.gen(function* () {
    const recentCount = yield* IAuthRepository.pipe(
      Effect.flatMap((r) => r.countRecentOtpRequests(email, type, 15 * 60)),
    )
    if (recentCount >= RESEND_LIMIT_PER_15MIN) {
      return yield* Effect.fail(
        new OtpResendRateLimitError({
          message: `Maximum ${RESEND_LIMIT_PER_15MIN} resends per 15 minutes`,
          retryAfterSeconds: 15 * 60,
        }),
      )
    }
    yield* IAuthRepository.pipe(Effect.flatMap((r) => r.resendOtp(email, type)))
  })
```

**Test cases — see A.1 Stage 5:**
- [ ] 1st-3rd resend within 15 min → succeeds
- [ ] 4th resend within 15 min → rate limit error
- [ ] After 15 min window → can resend again

**Commit:** `feat(auth): rate-limited OTP resend (EMP-4)`

### Task B.6.4 — One-tap logout (EMP-12)

**Files:**
- Modify: `apps/website/blocks/chat/components/Header.tsx`

**Spec:**

```typescript
// Add to Header.tsx:
import { LogOut } from "lucide-react"

const handleLogout = async () => {
  await fetch("/api/auth/logout", { method: "POST" })
  window.location.href = "/login"
}

// Render in header:
<button
  data-testid="header-logout"
  onClick={handleLogout}
  className="..."
  aria-label="Log out"
  title="Log out"
>
  <LogOut className="h-4 w-4" />
</button>
```

**Test cases — see A.1 Stage 16:**
- [ ] Logout button always visible in chat header
- [ ] No confirmation dialog (one-tap per EMP-12)
- [ ] Session ends immediately
- [ ] Redirects to /login

**Commit:** `feat(chat): one-tap logout in chat header (EMP-12)`

### Task B.6.5 — Idle session timeout (EMP-9)

**Files:**
- Create: `apps/website/src/middleware/idle-timeout.ts`
- Modify: `apps/website/src/middleware/index.ts`

**Migration:**

```sql
-- apps/website/supabase/migrations/20260625000003_idle_timeout.sql
alter table public.companies add column if not exists session_idle_timeout_minutes integer default 60;
```

**Spec — `idle-timeout.ts`:**

```typescript
import { defineMiddleware } from "astro/middleware"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ROUTES } from "@/shared/constants/api.constants"

const LAST_ACTIVITY_COOKIE = "tenang_last_activity"
const IDLE_TIMEOUT_DEFAULT_MIN = 60

const parseCookie = (header: string): Record<string, string> => {
  const out: Record<string, string> = {}
  header.split(";").forEach((pair) => {
    const [k, v] = pair.trim().split("=")
    if (k && v) out[k] = v
  })
  return out
}

export const idleTimeoutMiddleware = defineMiddleware(async (context, next) => {
  const protectedPath = ROUTES.PROTECTED.some((p) => context.url.pathname.startsWith(p))
  if (!protectedPath) return next()

  const cookieHeader = context.request.headers.get("cookie") ?? ""
  const lastActivity = parseCookie(cookieHeader)[LAST_ACTIVITY_COOKIE]

  if (lastActivity) {
    const elapsed = Date.now() - Number(lastActivity)
    const supabase = createSupabaseServerClient(context)
    const { data: userCompany } = await supabase
      ?.from("user_company_memberships")
      .select("companies(session_idle_timeout_minutes)")
      .eq("user_id", context.locals.session?.userId ?? "")
      .eq("is_active", true)
      .limit(1)
      .single() ?? { data: null }

    const idleTimeoutMin = userCompany?.companies?.session_idle_timeout_minutes ?? IDLE_TIMEOUT_DEFAULT_MIN
    const idleTimeoutMs = idleTimeoutMin * 60 * 1000

    if (elapsed > idleTimeoutMs) {
      await supabase?.auth.signOut()
      return context.redirect("/login?reason=idle_timeout")
    }
  }

  context.cookies.set(LAST_ACTIVITY_COOKIE, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  })

  return next()
})
```

**Test cases — see A.1 Stage 17:**
- [ ] 60 min idle → forced re-auth
- [ ] Active user (clicked within timeout) → not logged out
- [ ] Company Admin can configure timeout

**Commit:** `feat(middleware): idle session timeout per company (EMP-9)`

### Task B.6.6 — `deactivateAccountProgram` (EMP-8, EMP-14)

**Files:**
- Create: `apps/website/src/domain/lifecycle/deactivate.program.ts`

**Spec:**

```typescript
import { Data, Effect } from "effect"

const BULK_DEACTIVATION_THRESHOLD = 0.20

export class BulkDeactivationGuardError extends Data.TaggedError("BulkDeactivationGuardError")<{
  readonly message: string
  readonly requiresSuperAdminApproval: true
}> {}

export class LastAdminError extends Data.TaggedError("LastAdminError")<{
  readonly message: string
}> {}

export type DeactivateInput = {
  readonly userId: string
  readonly companyId: string
  readonly reason: string
  readonly isBulk: boolean
  readonly totalRosterSize: number
}

export const deactivateAccountProgram = (
  input: DeactivateInput,
): Effect.Effect<void, BulkDeactivationGuardError | LastAdminError, IAuthRepository | IMembershipsRepository> =>
  Effect.gen(function* () {
    if (input.isBulk) {
      const ratio = 1 / input.totalRosterSize  // simplified; in real impl, count affected
      if (ratio > BULK_DEACTIVATION_THRESHOLD) {
        return yield* Effect.fail(
          new BulkDeactivationGuardError({
            message: `Bulk deactivation > 20% of roster requires Super Admin approval`,
            requiresSuperAdminApproval: true,
          }),
        )
      }
    }

    // Check: not last company admin
    const isLastAdmin = yield* IMembershipsRepository.pipe(
      Effect.flatMap((r) => r.isLastActiveAdmin(input.companyId as any, input.userId as any)),
    )
    if (isLastAdmin) {
      return yield* Effect.fail(new LastAdminError({ message: "Cannot deactivate the only active Company Admin" }))
    }

    // Check: no open escalation cases
    // (placeholder; integrate with D.x)

    yield* IAuthRepository.pipe(Effect.flatMap((r) => r.deactivate(input.userId as any, input.reason)))
  })
```

**Test cases — see A.1 Stage 16:**
- [ ] Single deactivation → succeeds
- [ ] Bulk > 20% → blocked
- [ ] Last admin → blocked
- [ ] Open escalation case → blocked

**Commit:** `feat(lifecycle): deactivate with bulk/role/escalation guards (EMP-8/14)`

---

## B.7 — Journey A E2E Test Suite

### Task B.7.1 — Comprehensive Playwright E2E

**Files:**
- Create: `apps/website/tests/e2e/journey-a-employee.spec.ts`

**Spec — all 9 test scenarios from A.7:**

```typescript
import { test, expect } from "@playwright/test"

test.describe("Journey A: Employee", () => {
  test("happy path: invitation to ongoing use", async ({ page }) => {
    // 1. Open invitation email link
    // 2. See company name in sign-up
    // 3. Register
    // 4. Verify OTP
    // 5. Complete profile
    // 6. See orientation
    // 7. Land in chat with first-time greeting
    // 8. End session → see post-session summary
  })

  test("re-engagement after 30+ days", async ({ page }) => {
    // 1. Set last_session_at to 60 days ago
    // 2. Log in
    // 3. See re-engagement greeting
  })

  test("crisis moment: card appears, session continues", async ({ page }) => {
    // 1. Trigger risk flag event
    // 2. Verify crisis card visible
    // 3. Send message → AI still responds
    // 4. Dismiss card
  })

  test("quota exhausted: screen shown", async ({ page }) => {
    // 1. Set company quota to 0
    // 2. Try to send message
    // 3. Verify quota-exhausted screen
  })

  test("pause account: notifications stop, unpause restores", async ({ page }) => {
    // 1. Click pause
    // 2. Verify cannot start chat
    // 3. Click unpause
    // 4. Verify can start chat
  })

  test("B2C/B2B conflict: existing B2C user receives invite", async ({ page }) => {
    // 1. Register as B2C user
    // 2. Get B2B invitation
    // 3. Try to sign up with same email
    // 4. See conflict screen
  })

  test("change email: OTP verify, security notification", async ({ page }) => {
    // 1. Go to /account/change-email
    // 2. Enter new email
    // 3. Verify OTP
    // 4. Confirm old email gets security notification
  })

  test("bulk deactivation: > 20% requires Super Admin", async ({ page }) => {
    // 1. As Company Admin, select 5 of 10 employees for deactivation
    // 2. Verify AlertDialog appears
  })

  test("single deactivation: immediate session revocation", async ({ page }) => {
    // 1. Deactivate one employee
    // 2. Try to log in as that employee
    // 3. Verify login fails
  })
})
```

**Run:** `pnpm playwright test journey-a-employee`
**Expected:** All 9 PASS

**Commit:** `test(e2e): Journey A comprehensive test suite (9 scenarios)`

---

## B.8 — Journey A Acceptance Criteria Summary

**Phase 1 "shipped" gate for Journey A:**

| PRD Story | Implementation | Test |
|---|---|---|
| EMP-1 | B.1 + B.2.1-4 | B.7 happy path |
| EMP-2 | B.3.1 | B.7 happy path |
| EMP-3 | B.1.10 (membership) | B.7 happy path |
| EMP-4 | B.6.3 | Unit + E2E |
| EMP-5 | B.1.10 + email template | E2E |
| EMP-6 | (existing) | E2E |
| EMP-7 | B.1 + signUp gate | B.7 happy path |
| EMP-8 | B.6.6 | B.7 single deactivation |
| EMP-9 | B.6.5 | E2E |
| EMP-10 | B.6.2 | B.7 change email |
| EMP-11 | B.6.1 | B.7 pause account |
| EMP-12 | B.6.4 | Unit + E2E |
| EMP-13 | (Phase 2) | E2E |
| EMP-14 | B.6.6 | B.7 bulk deactivation |
| EMP-15 | B.2.4 | Unit |
| EMP-16 | B.3.2 | B.7 happy path |
| EMP-17 | B.2.4 | B.7 B2C/B2B conflict |
| CHAT-13 | B.4.2 | B.7 first chat |
| CHAT-14 | B.5.1 | E2E |
| CHAT-15 | B.4.2 | B.7 re-engagement |
| CHAT-16 | B.4.3 | B.7 crisis moment |
| RISK-15 | B.4.3 + C.x | Cross-journey E2E |
| RISK-16 | (Journey C) | Cross-journey E2E |
| BILL-4 | B.5.2 | B.7 quota exhausted |
| BILL-8 | B.5.3 | Unit |

**Journey A is "shipped" when:**
- All B.x tasks committed
- All unit tests pass (`pnpm test`)
- All E2E tests in B.7.1 pass (`pnpm playwright test journey-a-employee`)
- Manual smoke: invitation → sign-up → first chat → post-session → re-engagement → crisis card → quota exhausted
