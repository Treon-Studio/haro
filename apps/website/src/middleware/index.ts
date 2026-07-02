import { sequence } from "astro/middleware"
import { onRequest as loggerMiddleware } from "./logger"
import { onRequest as authMiddleware } from "./auth"

export const onRequest = sequence(loggerMiddleware, authMiddleware)
