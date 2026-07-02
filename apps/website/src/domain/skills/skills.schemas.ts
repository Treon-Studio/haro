import { Schema } from "@effect/schema"

export const CreateSkillSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1, { message: () => "Nama skill tidak boleh kosong" })),
  description: Schema.String.pipe(Schema.minLength(1, { message: () => "Deskripsi tidak boleh kosong" })),
  body: Schema.String,
  category: Schema.String,
  companyId: Schema.optional(Schema.NullOr(Schema.String)),
})

export type CreateSkillCommand = Schema.Schema.Type<typeof CreateSkillSchema>
