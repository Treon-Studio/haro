import { Effect } from 'effect'
import { Schema } from '@effect/schema'
import { AgentsRepository } from './agents.repository'
import { CreateAgentSchema } from './agents.schemas'

export const getAllAgentsProgram = (companyId?: string | null) => Effect.gen(function* (_) {
  const repo = yield* _(AgentsRepository)
  return yield* _(repo.getAll(companyId))
})

export const getAgentByIdProgram = (id: string) => Effect.gen(function* (_) {
  const repo = yield* _(AgentsRepository)
  return yield* _(repo.getById(id))
})

export const createAgentProgram = (input: unknown) => Effect.gen(function* (_) {
  const repo = yield* _(AgentsRepository)

  // Validasi input
  const decode = Schema.decodeUnknown(CreateAgentSchema)
  const validData = yield* _(decode(input))

  // Simpan ke DB
  const newAgent = yield* _(repo.create(validData))

  return newAgent
})
