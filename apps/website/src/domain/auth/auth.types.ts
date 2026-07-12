import type { TUserId, TSessionId } from "@/shared/types/common.types"

export type TAuthCredentials = {
  readonly email: string
  readonly password: string
}

export type TAuthSignUpProps = {
  readonly email: string
  readonly password: string
  readonly fullName: string
}

export type TUser = {
  readonly id: TUserId
  readonly email: string
  readonly fullName: string
  readonly avatarUrl: string | null
  readonly emailVerifiedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type TSession = {
  readonly id: TSessionId
  readonly userId: TUserId
  readonly expiresAt: string
  readonly createdAt: string
}

export type TAuthResult = {
  readonly user: TUser
  readonly session: TSession
  // Present only when signup was completed via an accepted invitation —
  // carries the invitation's real company/tenant identity.
  readonly companyId?: string
  readonly companyName?: string
}

export type TUserDto = {
  readonly id: string
  readonly email: string
  readonly full_name: string
  readonly avatar_url: string | null
  readonly email_verified_at: string | null
  readonly created_at: string
  readonly updated_at: string
}

export type TAuthDto = {
  readonly user: TUserDto
  readonly session: {
    readonly id: string
    readonly user_id: string
    readonly expires_at: string
    readonly created_at: string
  }
  // Present only when signup was completed via an accepted invitation —
  // lets callers (e.g. signup.ts) distinguish "invited into an existing
  // company" from an organic signup without re-querying.
  readonly company_id?: string
  readonly company_name?: string
}
