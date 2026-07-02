import { Schema } from "@effect/schema"

export const CreateProjectSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1, { message: () => "Nama proyek tidak boleh kosong" })),
  companyId: Schema.optional(Schema.NullOr(Schema.String)),
})

export type CreateProjectCommand = Schema.Schema.Type<typeof CreateProjectSchema>
