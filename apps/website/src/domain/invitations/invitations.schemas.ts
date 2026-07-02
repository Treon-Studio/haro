import { Schema } from "@effect/schema"

export const CreateInvitationSchema = Schema.Struct({
  companyId: Schema.String,
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  role: Schema.Union(Schema.Literal("owner"), Schema.Literal("admin"), Schema.Literal("member")),
})

export const VerifyInvitationSchema = Schema.Struct({
  token: Schema.String,
})

export const AcceptInvitationSchema = Schema.Struct({
  token: Schema.String,
  userId: Schema.String,
})

export type CreateInvitationCommand = Schema.Schema.Type<typeof CreateInvitationSchema>
export type VerifyInvitationCommand = Schema.Schema.Type<typeof VerifyInvitationSchema>
export type AcceptInvitationCommand = Schema.Schema.Type<typeof AcceptInvitationSchema>
