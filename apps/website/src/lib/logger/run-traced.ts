import { Effect } from "effect"
import type { LoggerService } from "./logger.service"

export function runTraced<A>(
  name: string,
  logger: LoggerService,
  effect: Effect.Effect<A, unknown, never>,
): Promise<A> {
  return Effect.runPromise(logger.withSpan(name, () => effect))
}
