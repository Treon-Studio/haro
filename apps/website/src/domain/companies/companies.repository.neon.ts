import { Effect } from "effect"
import { ICompaniesRepository } from "./companies.repository"
import type { TCompany, TCompanyMembership } from "./companies.types"
import {
	CompanyCreationError,
	CompanyFetchError,
	CompanyUpdateError,
	CompanyNotFoundError,
	CompanyMembershipError,
	UnauthorizedError,
} from "./companies.errors"
import { query, transaction } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapCompanyData = (data: any): TCompany => ({
	id: data.id,
	name: data.name,
	createdAt: data.created_at,
	updatedAt: data.updated_at,
})

const mapMembershipData = (data: any): TCompanyMembership => ({
	id: data.id,
	companyId: data.company_id,
	userId: data.user_id,
	role: data.role as "owner" | "admin" | "member",
	status: data.status as "active" | "invited" | "suspended",
	createdAt: data.created_at,
	updatedAt: data.updated_at,
})

export const makeNeonCompaniesRepository = (
	context: any,
): ICompaniesRepository["Type"] => ({
	createCompany: (name) =>
		Effect.tryPromise({
			try: async () => {
				let userId: string
				try {
					userId = await getCurrentUserId(context)
				} catch {
					throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
				}

				const company = await transaction(async (client) => {
					// Step 1: Insert company
					const companyRes = await client.query(
						`INSERT INTO public.companies (name)
                         VALUES ($1)
                         RETURNING *`,
						[name],
					)
					const companyRow = companyRes.rows[0]
					if (!companyRow) throw new CompanyCreationError({ message: "Gagal membuat perusahaan" })

					// Step 2: Insert owner membership
					await client.query(
						`INSERT INTO public.company_memberships (company_id, user_id, role, status)
                         VALUES ($1, $2, 'owner', 'active')`,
						[companyRow.id, userId],
					)

					return companyRow
				})

				return mapCompanyData(company)
			},
			catch: (err: any) => {
				if (err instanceof UnauthorizedError) return err
				if (err instanceof CompanyCreationError) return err
				return new CompanyCreationError({ message: err?.message || "Unknown error occurred" })
			},
		}),

	getCompanies: () =>
		Effect.tryPromise({
			try: async () => {
				try {
					await getCurrentUserId(context)
				} catch {
					throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
				}

				// Raw SQL join to get companies the user has membership in
				const res = await query(
					`SELECT c.*
                     FROM public.companies c
                     JOIN public.company_memberships m ON c.id = m.company_id
                     WHERE m.user_id = $1
                     ORDER BY c.created_at DESC`,
					[], // getCurrentUserId is called inside for auth check; we re-call via context
				)

				// Re-extract userId for the query param (session check done above)
				const userId = await getCurrentUserId(context)
				const res2 = await query(
					`SELECT c.*
                     FROM public.companies c
                     JOIN public.company_memberships m ON c.id = m.company_id
                     WHERE m.user_id = $1
                     ORDER BY c.created_at DESC`,
					[userId],
				)

				if (!res2.rows) return []
				return res2.rows.map(mapCompanyData)
			},
			catch: (err: any) => {
				if (err instanceof UnauthorizedError) return err
				if (err instanceof CompanyFetchError) return err
				return new CompanyFetchError({ message: err?.message || "Unknown error occurred" })
			},
		}),

	updateCompany: (id, name) =>
		Effect.tryPromise({
			try: async () => {
				try {
					await getCurrentUserId(context)
				} catch {
					throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
				}

				const res = await query(
					`UPDATE public.companies SET name = $1 WHERE id = $2 RETURNING *`,
					[name, id],
				)

				const row = res.rows[0]
				if (!row) throw new CompanyNotFoundError({ message: "Perusahaan tidak ditemukan atau Anda tidak memiliki akses" })

				return mapCompanyData(row)
			},
			catch: (err: any) => {
				if (err instanceof UnauthorizedError) return err
				if (err instanceof CompanyNotFoundError) return err
				if (err instanceof CompanyUpdateError) return err
				return new CompanyUpdateError({ message: err?.message || "Unknown error occurred" })
			},
		}),

	getCompanyMembers: (companyId) =>
		Effect.tryPromise({
			try: async () => {
				try {
					await getCurrentUserId(context)
				} catch {
					throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
				}

				const res = await query(
					`SELECT * FROM public.company_memberships
                     WHERE company_id = $1
                     ORDER BY created_at ASC`,
					[companyId],
				)

				if (!res.rows) return []
				return res.rows.map(mapMembershipData)
			},
			catch: (err: any) => {
				if (err instanceof UnauthorizedError) return err
				if (err instanceof CompanyMembershipError) return err
				return new CompanyMembershipError({ message: err?.message || "Unknown error occurred" })
			},
		}),

	addCompanyMember: (companyId, userId, role) =>
		Effect.tryPromise({
			try: async () => {
				try {
					await getCurrentUserId(context)
				} catch {
					throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
				}

				const res = await query(
					`INSERT INTO public.company_memberships (company_id, user_id, role, status)
                     VALUES ($1, $2, $3, 'invited')
                     RETURNING *`,
					[companyId, userId, role],
				)

				const row = res.rows[0]
				if (!row) throw new CompanyMembershipError({ message: "Gagal menambahkan anggota" })

				return mapMembershipData(row)
			},
			catch: (err: any) => {
				if (err instanceof UnauthorizedError) return err
				if (err instanceof CompanyMembershipError) return err
				return new CompanyMembershipError({ message: err?.message || "Unknown error occurred" })
			},
		}),

	updateCompanyMember: (membershipId, role, status) =>
		Effect.tryPromise({
			try: async () => {
				try {
					await getCurrentUserId(context)
				} catch {
					throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
				}

				const res = await query(
					`UPDATE public.company_memberships
                     SET role = $1, status = $2
                     WHERE id = $3
                     RETURNING *`,
					[role, status, membershipId],
				)

				const row = res.rows[0]
				if (!row) throw new CompanyMembershipError({ message: "Anggota tidak ditemukan" })

				return mapMembershipData(row)
			},
			catch: (err: any) => {
				if (err instanceof UnauthorizedError) return err
				if (err instanceof CompanyMembershipError) return err
				return new CompanyMembershipError({ message: err?.message || "Unknown error occurred" })
			},
		}),

	removeCompanyMember: (membershipId) =>
		Effect.tryPromise({
			try: async () => {
				try {
					await getCurrentUserId(context)
				} catch {
					throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
				}

				await query(
					`DELETE FROM public.company_memberships WHERE id = $1`,
					[membershipId],
				)
			},
			catch: (err: any) => {
				if (err instanceof UnauthorizedError) return err
				if (err instanceof CompanyMembershipError) return err
				return new CompanyMembershipError({ message: err?.message || "Unknown error occurred" })
			},
		}),
})