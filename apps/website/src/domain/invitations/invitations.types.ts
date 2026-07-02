export type TInvitation = {
  readonly id: string
  readonly companyId: string
  readonly companyName?: string
  readonly email: string
  readonly role: "owner" | "admin" | "member"
  readonly tokenHash: string
  readonly invitedBy: string
  readonly expiresAt: string
  readonly status: "pending" | "accepted" | "expired" | "revoked"
  readonly acceptedAt: string | null
  readonly createdAt: string
}

export type TInvitationDto = {
  readonly id: string
  readonly company_id: string
  readonly company_name?: string
  readonly email: string
  readonly role: string
  readonly token_hash: string
  readonly invited_by: string
  readonly expires_at: string
  readonly status: string
  readonly accepted_at: string | null
  readonly created_at: string
}

export const toInvitationDto = (invitation: TInvitation): TInvitationDto => ({
  id: invitation.id,
  company_id: invitation.companyId,
  company_name: invitation.companyName,
  email: invitation.email,
  role: invitation.role,
  token_hash: invitation.tokenHash,
  invited_by: invitation.invitedBy,
  expires_at: invitation.expiresAt,
  status: invitation.status,
  accepted_at: invitation.acceptedAt,
  created_at: invitation.createdAt,
})
