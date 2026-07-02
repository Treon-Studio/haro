/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

import type { LoggerService } from "@/lib/logger/logger.service"

declare global {
  namespace App {
    interface Locals {
      session: {
        userId: string
        email: string
        sessionId: string
      } | null
      logger: LoggerService
      requestId: string
    }
  }
}

export {}
