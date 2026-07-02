import { Schema } from "@effect/schema"

export const CreatePromptSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1, { message: () => "Nama prompt tidak boleh kosong" })),
  category: Schema.String.pipe(Schema.minLength(1, { message: () => "Kategori tidak boleh kosong" })),
  snippet: Schema.String.pipe(Schema.minLength(1, { message: () => "Isi prompt tidak boleh kosong" })),
  authorName: Schema.optional(Schema.String),
  isPublic: Schema.optional(Schema.Boolean),
  companyId: Schema.optional(Schema.NullOr(Schema.String)),
})

export type CreatePromptCommand = Schema.Schema.Type<typeof CreatePromptSchema>
