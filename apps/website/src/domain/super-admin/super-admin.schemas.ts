import { Schema } from "@effect/schema"

export const CreateHandoffSchema = Schema.Struct({
  companyName: Schema.String.pipe(Schema.minLength(1)),
  companySize: Schema.Number,
  billingModel: Schema.Union(Schema.Literal("flat_rate"), Schema.Literal("per_seat"), Schema.Literal("usage_based")),
  companyAdminEmail: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  contractTerms: Schema.optional(Schema.String),
  goLiveDate: Schema.optional(Schema.NullOr(Schema.String)),
  salesContact: Schema.String.pipe(Schema.minLength(1)),
})

export type CreateHandoffCommand = Schema.Schema.Type<typeof CreateHandoffSchema>
