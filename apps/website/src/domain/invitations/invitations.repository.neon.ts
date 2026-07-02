import { Effect } from "effect"
import { IInvitationsRepository } from "./invitations.repository"
import type { TInvitation } from "./invitations.types"
import {
	InvitationCreationError,
	InvitationFetchError,
	InvitationValidationError,
	InvitationAcceptError,
	UnauthorizedError,
} from "./invitations.errors"
import { query, transaction } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapInvitationData = (data: any): TInvitation => ({
	id: data.id,
	companyId: data.company_id,
	companyName: data.company_name,
	email: data.email,
	role: data.role as "owner" | "admin" | "member",
	tokenHash: data.token_hash,
	invitedBy: data.invited_by,
	expiresAt: data.expires_at,
	status: data.status as "pending" | "accepted" | "expired" | "revoked",
	acceptedAt: data.accepted_at,
	createdAt: data.created_at,
})

export const makeNeonInvitationsRepository = (
	context: any,
): IInvitationsRepository["Type"] => ({
	createInvitation: (companyId, email, role, tokenHash, expiresAt) =>
		Effect.tryPromise({
			try: async () => {
				let userId: string
				try {
					userId = await getCurrentUserId(context)
				} catch {
					throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
				}

				const res = await query(
					`INSERT INTO public.invitations
                     (company_id, email, role, token_hash, invited_by, expires_at)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING *`,
					[companyId, email, role, tokenHash, userId, expiresAt],
				)

				const row = res.rows[0]
				if (!row) throw new InvitationCreationError({ message: "Gagal membuat undangan" })

				return mapInvitationData(row)
			},
			catch: (err: any) => {
				if (err instanceof UnauthorizedError) return err
				if (err instanceof InvitationCreationError) return err
				return new InvitationCreationError({ message: err?.message || "Unknown error occurred" })
			},
		}),

	getInvitations: (companyId) =>
		Effect.tryPromise({
			try: async () => {
				try {
					await getCurrentUserId(context)
				} catch {
					throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
				}

				const res = await query(
					`SELECT * FROM public.invitations
                     WHERE company_id = $1
                     ORDER BY created_at DESC`,
					[companyId],
				)

				if (!res.rows) return []
				return res.rows.map(mapInvitationData)
			},
			catch: (err: any) => {
				if (err instanceof UnauthorizedError) return err
				if (err instanceof InvitationFetchError) return err
				return new InvitationFetchError({ message: err?.message || "Unknown error occurred" })
			},
		}),

	verifyInvitation: (tokenHash) =>
		Effect.tryPromise({
			try: async () => {
				// verifyInvitation is public-facing — no auth check needed
				const res = await query(
					`SELECT i.*, c.name as company_name
                     FROM public.invitations i
                     JOIN public.companies c ON c.id = i.company_id
                     WHERE i.token_hash = $1`,
					[tokenHash],
				)

				const row = res.rows[0]
				if (!row) {
					throw new InvitationValidationError({ message: "Undangan tidak valid atau sudah kedaluwarsa" })
				}

				const invitation = mapInvitationData(row)

				if (invitation.status !== "pending") {
					throw new InvitationValidationError({ message: `Undangan ini sudah berstatus ${invitation.status}` })
				}

				const isExpired = new Date(invitation.expiresAt).getTime() < Date.now()
				if (isExpired) {
					// Update status in background
					await query(
						`UPDATE public.invitations SET status = 'expired' WHERE id = $1`,
						[invitation.id],
					)
					throw new InvitationValidationError({ message: "Masa berlaku undangan ini telah berakhir (24 jam)" })
				}

				return invitation
			},
			catch: (err: any) => {
				if (err instanceof InvitationValidationError) return err
				return new InvitationValidationError({ message: err?.message || "Unknown error occurred" })
			},
		}),

	acceptInvitation: (id, userId) =>
		Effect.tryPromise({
			try: async () => {
				// acceptInvitation is user-initiated — no auth check needed
				const result = await transaction(async (client) => {
					// Step 1: Fetch invitation
					const fetchRes = await client.query(
						`SELECT * FROM public.invitations WHERE id = $1`,
						[id],
					)
					const invitationRow = fetchRes.rows[0]
					if (!invitationRow) throw new InvitationAcceptError({ message: "Undangan tidak ditemukan" })

					if (invitationRow.status !== "pending") {
						throw new InvitationAcceptError({ message: "Undangan ini sudah tidak aktif" })
					}

					// Step 2: Insert into company_memberships
					await client.query(
						`INSERT INTO public.company_memberships (company_id, user_id, role, status)
                         VALUES ($1, $2, $3, 'active')`,
						[invitationRow.company_id, userId, invitationRow.role],
					)

					// Step 3: Update invitation status to accepted
					const updateRes = await client.query(
						`UPDATE public.invitations
                         SET status = 'accepted', accepted_at = NOW()
                         WHERE id = $1
                         RETURNING *`,
						[id],
					)

					const updatedRow = updateRes.rows[0]
					if (!updatedRow) throw new InvitationAcceptError({ message: "Gagal memperbarui status undangan" })

					return updatedRow
				})

				return mapInvitationData(result)
			},
			catch: (err: any) => {
				if (err instanceof InvitationAcceptError) return err
				return new InvitationAcceptError({ message: err?.message || "Unknown error occurred" })
			},
		}),

	revokeInvitation: (id) =>
		Effect.tryPromise({
			try: async () => {
				try {
					await getCurrentUserId(context)
				} catch {
					throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
				}

				await query(
					`UPDATE public.invitations SET status = 'revoked' WHERE id = $1`,
					[id],
				)
			},
			catch: (err: any) => {
				if (err instanceof UnauthorizedError) return err
				if (err instanceof InvitationAcceptError) return err
				return new InvitationAcceptError({ message: err?.message || "Unknown error occurred" })
			},
		}),
})