import { Data } from 'effect'

export class AgentNotFoundError extends Data.TaggedError('AgentNotFoundError')<{
  readonly id: string
}> {}

export class AgentCreateError extends Data.TaggedError('AgentCreateError')<{
  readonly cause: unknown
}> {}

export class AgentFetchError extends Data.TaggedError('AgentFetchError')<{
  readonly cause: unknown
}> {}
