import { Context, Effect } from "effect"
import type { TInvitation } from "./invitations.types"
import {
  InvitationCreationError,
  InvitationFetchError,
  InvitationValidationError,
  InvitationAcceptError,
  UnauthorizedError,
} from "./invitations.errors"

export class IInvitationsRepository extends Context.Tag("IInvitationsRepository")<
  IInvitationsRepository,
  {
    readonly createInvitation: (
      companyId: string,
      email: string,
      role: "owner" | "admin" | "member",
      tokenHash: string,
      expiresAt: string,
    ) => Effect.Effect<TInvitation, InvitationCreationError | UnauthorizedError>

    readonly getInvitations: (
      companyId: string,
    ) => Effect.Effect<readonly TInvitation[], InvitationFetchError | UnauthorizedError>

    readonly verifyInvitation: (
      tokenHash: string,
    ) => Effect.Effect<TInvitation, InvitationValidationError | UnauthorizedError>

    readonly acceptInvitation: (
      id: string,
      userId: string,
    ) => Effect.Effect<TInvitation, InvitationAcceptError | UnauthorizedError>

    readonly revokeInvitation: (
      id: string,
    ) => Effect.Effect<void, InvitationAcceptError | UnauthorizedError>
  }
> () {}
