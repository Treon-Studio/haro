import { Schema } from "@effect/schema"

export const UpdateProfileSchema = Schema.Struct({
  fullName: Schema.optional(Schema.NullOr(Schema.String)),
  ageRange: Schema.optional(
    Schema.NullOr(
      Schema.Union(
        Schema.Literal("18-24"),
        Schema.Literal("25-34"),
        Schema.Literal("35-44"),
        Schema.Literal("45-54"),
        Schema.Literal("55+")
      )
    )
  ),
  gender: Schema.optional(Schema.NullOr(Schema.String)),
  pronouns: Schema.optional(Schema.NullOr(Schema.String)),
  phone: Schema.optional(Schema.NullOr(Schema.String)),
  language: Schema.optional(Schema.Union(Schema.Literal("id"), Schema.Literal("en"))),
  notificationOptIn: Schema.optional(Schema.Boolean),
  department: Schema.optional(Schema.NullOr(Schema.String)),
  onboardingCompleted: Schema.optional(Schema.Boolean),
})

export type UpdateProfileCommand = Schema.Schema.Type<typeof UpdateProfileSchema>
