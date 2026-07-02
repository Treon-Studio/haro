import { Schema } from '@effect/schema'

export const CreateAgentSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1, { message: () => "Name cannot be empty" })),
  description: Schema.String.pipe(Schema.minLength(1, { message: () => "Description cannot be empty" })),
  category: Schema.String,
  author: Schema.String,
  avatarUrl: Schema.optional(Schema.String),
  isPromoted: Schema.optional(Schema.Boolean),
  companyId: Schema.optional(Schema.NullOr(Schema.String)),
})

export type CreateAgentCommand = Schema.Schema.Type<typeof CreateAgentSchema>
