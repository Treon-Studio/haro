import { Schema } from "@effect/schema"

export const CreateCompanySchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
})

export const UpdateCompanySchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String.pipe(Schema.minLength(1)),
})

export const AddMemberSchema = Schema.Struct({
  companyId: Schema.String,
  userId: Schema.String,
  role: Schema.Union(Schema.Literal("owner"), Schema.Literal("admin"), Schema.Literal("member")),
})

export const UpdateMemberSchema = Schema.Struct({
  membershipId: Schema.String,
  role: Schema.Union(Schema.Literal("owner"), Schema.Literal("admin"), Schema.Literal("member")),
  status: Schema.Union(Schema.Literal("active"), Schema.Literal("invited"), Schema.Literal("suspended")),
})

export type CreateCompanyCommand = Schema.Schema.Type<typeof CreateCompanySchema>
export type UpdateCompanyCommand = Schema.Schema.Type<typeof UpdateCompanySchema>
export type AddMemberCommand = Schema.Schema.Type<typeof AddMemberSchema>
export type UpdateMemberCommand = Schema.Schema.Type<typeof UpdateMemberSchema>
