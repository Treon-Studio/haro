import { Effect, Context } from 'effect'
import type { Agent } from './agents.types'
import { AgentFetchError, AgentNotFoundError, AgentCreateError } from './agents.errors'

export class AgentsRepository extends Context.Tag('AgentsRepository')<
  AgentsRepository,
  {
    readonly getAll: (companyId?: string | null) => Effect.Effect<Agent[], AgentFetchError>
    readonly getById: (id: string) => Effect.Effect<Agent, AgentFetchError | AgentNotFoundError>
    readonly create: (data: Partial<Agent> & { companyId?: string | null }) => Effect.Effect<Agent, AgentCreateError>
  }
> () {}
