import { Effect } from "effect"
import { ISuperAdminRepository } from "./super-admin.repository"
import type { THandoff } from "./super-admin.types"
import type { TCompany } from "@/domain/companies/index"
import {
  HandoffCreationError,
  HandoffFetchError,
  TenantProvisionError,
  UnauthorizedError,
} from "./super-admin.errors"
import type { CreateHandoffCommand } from "./super-admin.schemas"
import { query } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapHandoffData = (data: any): THandoff => ({
  id: data.id,
  companyName: data.company_name,
  companySize: data.company_size,
  billingModel: data.billing_model,
  companyAdminEmail: data.company_admin_email,
  contractTerms: data.contract_terms,
  goLiveDate: data.go_live_date,
  salesContact: data.sales_contact,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
})

const verifySuperAdminRole = async (userId: string): Promise<void> => {
  const res = await query(
    `SELECT id FROM public.company_memberships WHERE user_id = $1 AND role = 'super_admin' AND status = 'active' LIMIT 1`,
    [userId]
  )
  if (!res.rows || res.rows.length === 0) {
    throw new UnauthorizedError({ message: "Anda tidak memiliki akses Super Admin" })
  }
}

export const makeNeonSuperAdminRepository = (
  context: any,
): ISuperAdminRepository["Type"] => ({
  createHandoff: (data: CreateHandoffCommand) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        await verifySuperAdminRole(userId)

        const res = await query(
          `INSERT INTO public.handoff_artefacts (company_name, company_size, billing_model, company_admin_email, contract_terms, go_live_date, sales_contact)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            data.companyName,
            data.companySize,
            data.billingModel,
            data.companyAdminEmail,
            data.contractTerms ?? null,
            data.goLiveDate ?? null,
            data.salesContact,
          ]
        )

        const created = res.rows[0]
        if (!created) throw new HandoffCreationError({ message: "Gagal membuat dokumen sales handoff" })

        return mapHandoffData(created)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof HandoffCreationError) return err
        return new HandoffCreationError({ message: err?.message || "Unknown error occurred" })
      },
    }),

  getHandoffs: () =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        await verifySuperAdminRole(userId)

        const res = await query(
          `SELECT * FROM public.handoff_artefacts ORDER BY created_at DESC`
        )

        if (!res.rows) return []

        return res.rows.map(mapHandoffData)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof HandoffFetchError) return err
        return new HandoffFetchError({ message: err?.message || "Unknown error occurred" })
      },
    }),

  provisionTenant: (handoffId: string) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        await verifySuperAdminRole(userId)

        const handoffRes = await query(
          `SELECT * FROM public.handoff_artefacts WHERE id = $1 LIMIT 1`,
          [handoffId]
        )

        const handoff = handoffRes.rows[0]
        if (!handoff) {
          throw new TenantProvisionError({ message: "Dokumen handoff tidak ditemukan" })
        }

        const companyRes = await query(
          `INSERT INTO companies (name) VALUES ($1) RETURNING *`,
          [handoff.company_name]
        )

        const company = companyRes.rows[0]
        if (!company) {
          throw new TenantProvisionError({ message: "Gagal membuat perusahaan" })
        }

        return {
          id: company.id,
          name: company.name,
          createdAt: company.created_at,
          updatedAt: company.updated_at,
        } as TCompany
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof TenantProvisionError) return err
        return new TenantProvisionError({ message: err?.message || "Unknown error occurred" })
      },
    }),
})
