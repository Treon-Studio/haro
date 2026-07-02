export const ROUTES = {
  API: {
    AUTH: {
      SIGNUP: "/api/auth/signup",
      LOGIN: "/api/auth/login",
      LOGOUT: "/api/auth/logout",
      VERIFY: "/api/auth/verify",
      FORGOT_PASSWORD: "/api/auth/forgot-password",
      RESET_PASSWORD: "/api/auth/reset-password",
      TWO_FACTOR: "/api/auth/2fa",
      SESSION: "/api/auth/session",
      OAUTH: "/api/auth/oauth/initiate",
      OAUTH_CALLBACK: "/api/auth/oauth/callback",
    },
  },
  PAGE: {
    LOGIN: "/login",
    SIGNUP: "/sign-up",
    FORGOT_PASSWORD: "/forgot-password",
    RESET_PASSWORD: "/reset-password",
    VERIFY: "/verify",
    TWO_FACTOR: "/login/2fa",
    DASHBOARD: "/c/new",
  },
  PROTECTED: ["/c/", "/projects/", "/skills/", "/prompts/", "/agents/", "/search/", "/files/", "/bookmarks/", "/memories/"],
  GUEST_ONLY: ["/login", "/sign-up", "/forgot-password", "/reset-password"],
} as const

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const

export const ERROR_TAG = {
  VALIDATION_ERROR: "ValidationError",
  INVALID_CREDENTIALS: "InvalidCredentialsError",
  EMAIL_NOT_VERIFIED: "EmailNotVerifiedError",
  EMAIL_ALREADY_REGISTERED: "EmailAlreadyRegisteredError",
  SESSION_EXPIRED: "SessionExpiredError",
  USER_NOT_FOUND: "UserNotFoundError",
  RATE_LIMITED: "RateLimitedError",
  DATABASE_ERROR: "DatabaseError",
  AUTH_PROVIDER_ERROR: "AuthProviderError",
  NETWORK_ERROR: "NetworkError",
} as const