const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const normalizeEmail = (raw: string): string =>
  raw.toLowerCase().trim()

export const AuthModule = {
  normalizeEmail: (raw: string): string => normalizeEmail(raw),

  isValidEmail: (email: string): boolean =>
    EMAIL_REGEX.test(normalizeEmail(email)),
} as const
