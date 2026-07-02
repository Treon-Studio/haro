export type TUserId = string & { readonly _brand: "UserId" }
export type TSessionId = string & { readonly _brand: "SessionId" }

export type TSessionUser = {
  readonly sessionId: TSessionId
  readonly userId: TUserId
  readonly email: string
}

export type TApiResponse<T> =
  | { readonly success: true; readonly data: T; readonly meta: TApiMeta }
  | { readonly success: false; readonly error: TApiError; readonly meta: TApiMeta }

export type TApiMeta = {
  readonly requestId: string
  readonly timestamp: string
}

export type TApiError = {
  readonly _tag: string
  readonly message: string
  readonly details?: string
}