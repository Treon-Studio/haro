import { Effect, Layer, ManagedRuntime } from "effect"
import { IAuthRepository } from "../../domain/auth/auth.repository"
import { makeNeonAuthRepository } from "../../domain/auth/auth.repository.neon"

export const AppLayer = Layer.empty

export const AppRuntime = ManagedRuntime.make(AppLayer)

export const runApp = <A, E>(
  effect: Effect.Effect<A, E, IAuthRepository>,
  context: any,
): Promise<A> =>
  AppRuntime.runPromise(
    effect.pipe(
      Effect.provide(
        Layer.succeed(IAuthRepository, makeNeonAuthRepository(context)),
      ),
    ),
  )
