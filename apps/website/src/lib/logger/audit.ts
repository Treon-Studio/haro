import { Effect } from "effect"
import type { LoggerService } from "./logger.service"
import type { TLogContext } from "./logger.types"

export function auditAction(
  logger: LoggerService,
  action: string,
  resourceType: string,
  resourceId: string,
  extra?: Record<string, unknown>,
): void {
  Effect.runSync(
    logger.audit(action, {
      action,
      resourceType,
      resourceId,
      ...extra,
    } as TLogContext),
  )
}

export function auditEntity(
  logger: LoggerService,
  operation: "create" | "update" | "delete" | "restore",
  entityType: string,
  entityId: string,
  changes?: Record<string, unknown>,
): void {
  const message = `${entityType}.${operation}`
  Effect.runSync(
    logger.audit(message, {
      action: message,
      resourceType: entityType,
      resourceId: entityId,
      changes: changes ?? {},
    } as TLogContext),
  )
}
