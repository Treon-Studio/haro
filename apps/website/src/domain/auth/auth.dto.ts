import type { TUser, TUserDto, TAuthResult, TAuthDto } from "./auth.types"

export const toUserDto = (user: TUser): TUserDto => ({
  id: user.id,
  email: user.email,
  full_name: user.fullName,
  avatar_url: user.avatarUrl,
  email_verified_at: user.emailVerifiedAt,
  created_at: user.createdAt,
  updated_at: user.updatedAt,
})

export const toAuthDto = (result: TAuthResult): TAuthDto => ({
  user: toUserDto(result.user),
  session: {
    id: result.session.id,
    user_id: result.session.userId,
    expires_at: result.session.expiresAt,
    created_at: result.session.createdAt,
  },
  company_id: result.companyId,
  company_name: result.companyName,
})
