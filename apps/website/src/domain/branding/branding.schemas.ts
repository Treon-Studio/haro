import { Schema } from "@effect/schema"

export const UpdateBrandingSchema = Schema.Struct({
  companyId: Schema.String,
  logoUrl: Schema.optional(Schema.NullOr(Schema.String)),
  primaryColor: Schema.optional(
    Schema.NullOr(
      Schema.String.pipe(
        Schema.pattern(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
          message: () => "Format warna harus HEX yang valid (e.g. #FF5733)",
        })
      )
    )
  ),
  welcomeMessage: Schema.optional(Schema.NullOr(Schema.String)),
  defaultLanguage: Schema.optional(Schema.Union(Schema.Literal("id"), Schema.Literal("en"))),
  notificationSettings: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export type UpdateBrandingCommand = Schema.Schema.Type<typeof UpdateBrandingSchema>
