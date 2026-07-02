# Phase 3 Neon Migration: Billing, Branding, Safety, Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the billing, branding, safety, and analytics domains from Supabase to Neon Postgres.
**Architecture:** Replace Supabase-based repositories with direct raw SQL implementations via the Neon `query` and `transaction` clients while preserving the existing Effect-TS based repository interfaces and types.
**Tech Stack:** Effect-TS, Neon Postgres (Serverless), TypeScript.

---

### Task 1: Migrate Billing Repository to Neon

**Files:**
- Create: `apps/website/src/domain/billing/billing.repository.neon.ts`
- Modify: `apps/website/src/domain/billing/index.ts`
- Delete: `apps/website/src/domain/billing/billing.repository.supabase.ts`

- [ ] **Step 1: Create the neon billing repository file**

```typescript
// apps/website/src/domain/billing/billing.repository.neon.ts
import { Effect } from "effect"
import { IBillingRepository } from "./billing.repository"
import type { TBillingInfo } from "./billing.types"
import { BillingFetchError, BillingUpdateError } from "./billing.errors"
import { query, transaction } from "@/lib/neon/client"

const mapBillingData = (data: any): TBillingInfo => {
  const quota = data.session_quota
  const used = data.sessions_used
  const isExceeded = used >= quota
  let warningLevel: "none" | "warning" | "critical" | "exceeded" = "none"

  if (isExceeded) warningLevel = "exceeded"
  else if (used >= quota * 0.95) warningLevel = "critical"
  else if (used >= quota * 0.8) warningLevel = "warning"

  return {
    companyId: data.id,
    sessionQuota: quota,
    sessionsUsed: used,
    isQuotaExceeded: isExceeded,
    warningLevel,
  }
}

export const makeNeonBillingRepository = (
  context: any,
): IBillingRepository["Type"] => ({
  getBillingInfo: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        const res = await query(
          `SELECT id, session_quota, sessions_used FROM public.companies WHERE id = $1`,
          [companyId]
        )

        const row = res.rows[0]
        if (!row) throw new BillingFetchError({ message: "Organisasi tidak ditemukan" })
        
        return mapBillingData(row)
      },
      catch: (err: any) => {
        if (err instanceof BillingFetchError) return err
        return new BillingFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  incrementSessionUsage: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        const updated = await transaction(async (client) => {
          // Fetch current
          const currentRes = await client.query(
            `SELECT sessions_used FROM public.companies WHERE id = $1`,
            [companyId]
          )
          const current = currentRes.rows[0]
          if (!current) throw new BillingUpdateError({ message: "Gagal memuat status kuota" })

          // Update
          const updateRes = await client.query(
            `UPDATE public.companies SET sessions_used = sessions_used + 1 WHERE id = $1 RETURNING id, session_quota, sessions_used`,
            [companyId]
          )
          
          const data = updateRes.rows[0]
          if (!data) throw new BillingUpdateError({ message: "Gagal mengupdate pemakaian kuota" })
          
          return data
        })

        return mapBillingData(updated)
      },
      catch: (err: any) => {
        if (err instanceof BillingUpdateError) return err
        return new BillingUpdateError({ message: err?.message || "Unknown error" })
      },
    }),
})
```

- [ ] **Step 2: Update the billing index file**

```typescript
// apps/website/src/domain/billing/index.ts
export * from "./billing.types"
export * from "./billing.errors"
export * from "./billing.repository"
export * from "./billing.repository.neon"
export * from "./billing.programs"
```

- [ ] **Step 3: Delete the supabase repository file**

```bash
rm apps/website/src/domain/billing/billing.repository.supabase.ts
```

### Task 2: Migrate Branding Repository to Neon

**Files:**
- Create: `apps/website/src/domain/branding/branding.repository.neon.ts`
- Modify: `apps/website/src/domain/branding/index.ts`
- Delete: `apps/website/src/domain/branding/branding.repository.supabase.ts`

- [ ] **Step 1: Create the neon branding repository file**

```typescript
// apps/website/src/domain/branding/branding.repository.neon.ts
import { Effect } from "effect"
import { IBrandingRepository } from "./branding.repository"
import type { TBranding } from "./branding.types"
import { BrandingFetchError, BrandingUpdateError, UnauthorizedError } from "./branding.errors"
import { query } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapBrandingData = (data: any): TBranding => ({
  companyId: data.company_id,
  logoUrl: data.logo_url,
  primaryColor: data.primary_color,
  welcomeMessage: data.welcome_message,
  defaultLanguage: data.default_language as "id" | "en",
  notificationSettings: data.notification_settings || {},
  updatedAt: data.updated_at,
  updatedBy: data.updated_by,
})

export const makeNeonBrandingRepository = (
  context: any,
): IBrandingRepository["Type"] => ({
  getBranding: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        try {
          await getCurrentUserId(context)
        } catch {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        const res = await query(
          `SELECT * FROM public.company_branding WHERE company_id = $1`,
          [companyId]
        )

        const row = res.rows[0]
        if (!row) return null

        return mapBrandingData(row)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof BrandingFetchError) return err
        return new BrandingFetchError({ message: err?.message || "Unknown error occurred" })
      },
    }),

  updateBranding: (companyId, data) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        const now = new Date().toISOString()
        const res = await query(
          `INSERT INTO public.company_branding (
            company_id, logo_url, primary_color, welcome_message, default_language, notification_settings, updated_by, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (company_id) DO UPDATE SET 
            logo_url = $2, 
            primary_color = $3, 
            welcome_message = $4, 
            default_language = $5, 
            notification_settings = $6, 
            updated_by = $7,
            updated_at = $8
          RETURNING *`,
          [
            companyId,
            data.logoUrl || null,
            data.primaryColor || null,
            data.welcomeMessage || null,
            data.defaultLanguage || "id",
            data.notificationSettings || {},
            userId,
            now
          ]
        )

        const row = res.rows[0]
        if (!row) throw new BrandingUpdateError({ message: "Gagal memperbarui branding" })

        return mapBrandingData(row)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof BrandingUpdateError) return err
        return new BrandingUpdateError({ message: err?.message || "Unknown error occurred" })
      },
    }),
})
```

- [ ] **Step 2: Update the branding index file**

```typescript
// apps/website/src/domain/branding/index.ts
export * from "./branding.types"
export * from "./branding.errors"
export * from "./branding.schemas"
export * from "./branding.repository"
export * from "./branding.repository.neon"
export * from "./branding.programs"
```

- [ ] **Step 3: Delete the supabase repository file**

```bash
rm apps/website/src/domain/branding/branding.repository.supabase.ts
```

### Task 3: Migrate Safety Repository to Neon

**Files:**
- Create: `apps/website/src/domain/safety/safety.repository.neon.ts`
- Modify: `apps/website/src/domain/safety/index.ts`
- Delete: `apps/website/src/domain/safety/safety.repository.supabase.ts`

- [ ] **Step 1: Create the neon safety repository file**

```typescript
// apps/website/src/domain/safety/safety.repository.neon.ts
import { Effect } from "effect"
import { ISafetyRepository } from "./safety.repository"
import type { TRiskFlag, TEscalationCase } from "./safety.types"
import { SafetyFetchError, SafetyUpdateError } from "./safety.errors"
import { query, transaction } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapRiskData = (data: any): TRiskFlag => ({
  id: data.id,
  userId: data.user_id,
  companyId: data.company_id,
  sessionId: data.session_id,
  tier: data.tier as "standard" | "critical",
  aiSummary: data.ai_summary,
  triggerPattern: data.trigger_pattern,
  createdAt: data.created_at,
})

const mapCaseData = (data: any): TEscalationCase => ({
  id: data.id,
  riskFlagId: data.risk_flag_id,
  companyId: data.company_id,
  status: data.status as "open" | "assigned" | "resolved" | "dismissed",
  primaryAssignee: data.primary_assignee,
  backupAssignee: data.backup_assignee,
  followupAttempts: data.followup_attempts || [],
  outcome: data.outcome,
  outcomeNotes: data.outcome_notes,
  resolvedAt: data.resolved_at,
  resolvedBy: data.resolved_by,
  createdAt: data.created_at,
})

export const makeNeonSafetyRepository = (
  context: any,
): ISafetyRepository["Type"] => ({
  flagRisk: (userId, companyId, sessionId, tier, summary, trigger) =>
    Effect.tryPromise({
      try: async () => {
        if (tier === "critical") {
          const result = await transaction(async (client) => {
            const flagRes = await client.query(
              `INSERT INTO public.risk_flags (user_id, company_id, session_id, tier, ai_summary, trigger_pattern)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
              [userId, companyId, sessionId, tier, summary, trigger]
            )
            const flag = flagRes.rows[0]
            if (!flag) throw new SafetyUpdateError({ message: "Gagal mencatat bendera risiko" })
            
            try {
              await client.query(
                `INSERT INTO public.escalation_cases (risk_flag_id, company_id, status)
                 VALUES ($1, $2, 'open')`,
                [flag.id, companyId]
              )
            } catch (caseError: any) {
              throw new SafetyUpdateError({ message: `Auto escalation failed: ${caseError.message}` })
            }
            
            return flag
          })
          return mapRiskData(result)
        } else {
          const res = await query(
            `INSERT INTO public.risk_flags (user_id, company_id, session_id, tier, ai_summary, trigger_pattern)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [userId, companyId, sessionId, tier, summary, trigger]
          )
          
          const flag = res.rows[0]
          if (!flag) throw new SafetyUpdateError({ message: "Gagal mencatat bendera risiko" })
          
          return mapRiskData(flag)
        }
      },
      catch: (err: any) => {
        if (err instanceof SafetyUpdateError) return err
        return new SafetyUpdateError({ message: err?.message || "Unknown error" })
      },
    }),

  getEscalationCases: () =>
    Effect.tryPromise({
      try: async () => {
        const res = await query(
          `SELECT * FROM public.escalation_cases WHERE status IN ('open', 'assigned') ORDER BY created_at DESC`
        )
        if (!res.rows) return []
        return res.rows.map(mapCaseData)
      },
      catch: (err: any) => {
        if (err instanceof SafetyFetchError) return err
        return new SafetyFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  assignCase: (caseId, assigneeId) =>
    Effect.tryPromise({
      try: async () => {
        const res = await query(
          `UPDATE public.escalation_cases SET status = 'assigned', primary_assignee = $2 WHERE id = $1 RETURNING *`,
          [caseId, assigneeId]
        )
        
        const row = res.rows[0]
        if (!row) throw new SafetyUpdateError({ message: "Gagal menetapkan penanganan kasus" })
        return mapCaseData(row)
      },
      catch: (err: any) => {
        if (err instanceof SafetyUpdateError) return err
        return new SafetyUpdateError({ message: err?.message || "Unknown error" })
      },
    }),

  logFollowupAttempt: (caseId, notes) =>
    Effect.tryPromise({
      try: async () => {
        const updated = await transaction(async (client) => {
          const currentRes = await client.query(
            `SELECT followup_attempts FROM public.escalation_cases WHERE id = $1`,
            [caseId]
          )
          
          const current = currentRes.rows[0]
          if (!current) throw new SafetyUpdateError({ message: "Gagal memuat log follow-up" })
          
          const attempts = current.followup_attempts || []
          const logs = [...attempts, { date: new Date().toISOString(), notes }]
          
          const updateRes = await client.query(
            `UPDATE public.escalation_cases SET followup_attempts = $1 WHERE id = $2 RETURNING *`,
            [JSON.stringify(logs), caseId]
          )
          
          const data = updateRes.rows[0]
          if (!data) throw new SafetyUpdateError({ message: "Gagal memperbarui log follow-up" })
          return data
        })
        
        return mapCaseData(updated)
      },
      catch: (err: any) => {
        if (err instanceof SafetyUpdateError) return err
        return new SafetyUpdateError({ message: err?.message || "Unknown error" })
      },
    }),

  resolveCase: (caseId, outcome, notes) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string | null = null
        try {
          userId = await getCurrentUserId(context)
        } catch {
          // ignore, user is optional here
        }

        const res = await query(
          `UPDATE public.escalation_cases SET status = 'resolved', outcome = $1, outcome_notes = $2, resolved_at = $3, resolved_by = $4 WHERE id = $5 RETURNING *`,
          [outcome, notes, new Date().toISOString(), userId, caseId]
        )
        
        const row = res.rows[0]
        if (!row) throw new SafetyUpdateError({ message: "Gagal menyelesaikan kasus" })
        return mapCaseData(row)
      },
      catch: (err: any) => {
        if (err instanceof SafetyUpdateError) return err
        return new SafetyUpdateError({ message: err?.message || "Unknown error" })
      },
    }),
})
```

- [ ] **Step 2: Update the safety index file**

```typescript
// apps/website/src/domain/safety/index.ts
export * from "./safety.types"
export * from "./safety.errors"
export * from "./safety.repository"
export * from "./safety.repository.neon"
export * from "./safety.programs"
```

- [ ] **Step 3: Delete the supabase repository file**

```bash
rm apps/website/src/domain/safety/safety.repository.supabase.ts
```

### Task 4: Migrate Analytics Repository to Neon

**Files:**
- Create: `apps/website/src/domain/analytics/analytics.repository.neon.ts`
- Modify: `apps/website/src/domain/analytics/index.ts`
- Delete: `apps/website/src/domain/analytics/analytics.repository.supabase.ts`

- [ ] **Step 1: Create the neon analytics repository file**

```typescript
// apps/website/src/domain/analytics/analytics.repository.neon.ts
import { Effect } from "effect"
import { IAnalyticsRepository } from "./analytics.repository"
import { AnalyticsFetchError } from "./analytics.errors"
import { query } from "@/lib/neon/client"

export const makeNeonAnalyticsRepository = (
  context: any,
): IAnalyticsRepository["Type"] => ({
  getCompanyMemberCount: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        const res = await query(
          `SELECT COUNT(*) as count FROM public.company_memberships WHERE company_id = $1 AND status = 'active'`,
          [companyId]
        )
        
        return parseInt(res.rows[0]?.count || "0", 10)
      },
      catch: (err: any) => {
        if (err instanceof AnalyticsFetchError) return err
        return new AnalyticsFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  getDailyActiveUsers: (companyId, limitDays) =>
    Effect.tryPromise({
      try: async () => {
        const res = await query(
          `SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as active_users 
           FROM public.session_metrics 
           WHERE company_id = $1 
           GROUP BY DATE(created_at) 
           ORDER BY date DESC 
           LIMIT $2`,
          [companyId, limitDays]
        )
        
        if (!res.rows) return []
        
        return res.rows.map(row => ({
          date: new Date(row.date).toISOString().split('T')[0],
          active_users: parseInt(row.active_users, 10)
        }))
      },
      catch: (err: any) => {
        if (err instanceof AnalyticsFetchError) return err
        return new AnalyticsFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  getTotalSessionsCount: (companyId, limitDays) =>
    Effect.tryPromise({
      try: async () => {
        const res = await query(
          `SELECT COUNT(*) as count FROM public.session_metrics WHERE company_id = $1`,
          [companyId]
        )
        
        return parseInt(res.rows[0]?.count || "0", 10)
      },
      catch: (err: any) => {
        if (err instanceof AnalyticsFetchError) return err
        return new AnalyticsFetchError({ message: err?.message || "Unknown error" })
      },
    }),
})
```

- [ ] **Step 2: Update the analytics index file**

```typescript
// apps/website/src/domain/analytics/index.ts
export * from "./analytics.types"
export * from "./analytics.errors"
export * from "./analytics.repository"
export * from "./analytics.repository.neon"
export * from "./analytics.programs"
```

- [ ] **Step 3: Delete the supabase repository file**

```bash
rm apps/website/src/domain/analytics/analytics.repository.supabase.ts
```

### Task 5: Update the API Helpers Client Implementations

**Files:**
- Modify: `apps/website/src/lib/api-helpers.ts`

- [ ] **Step 1: Replace Supabase imports with Neon ones**

In `apps/website/src/lib/api-helpers.ts`, change imports:
```typescript
import {
  IAnalyticsRepository,
  makeNeonAnalyticsRepository,
} from "@/domain/analytics/index";
// ...
import {
  IBillingRepository,
  makeNeonBillingRepository,
} from "@/domain/billing/index";
import {
  IBrandingRepository,
  makeNeonBrandingRepository,
} from "@/domain/branding/index";
// ...
import {
  ISafetyRepository,
  makeNeonSafetyRepository,
} from "@/domain/safety/index";
```

*(Ensure you keep the other imports exactly as they are).*

- [ ] **Step 2: Update `runBrandingEffect`**

```typescript
export const runBrandingEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const neonRepo = makeNeonBrandingRepository(context);
	return runRepoEffect(
		context,
		"branding",
		effect.pipe(Effect.provideService(IBrandingRepository, neonRepo)),
	);
};
```

- [ ] **Step 3: Update `runBillingEffect`**

```typescript
export const runBillingEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const neonRepo = makeNeonBillingRepository(context);
	return runRepoEffect(
		context,
		"billing",
		effect.pipe(Effect.provideService(IBillingRepository, neonRepo)),
	);
};
```

- [ ] **Step 4: Update `runSafetyEffect`**

```typescript
export const runSafetyEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const neonRepo = makeNeonSafetyRepository(context);
	return runRepoEffect(
		context,
		"safety",
		effect.pipe(Effect.provideService(ISafetyRepository, neonRepo)),
	);
};
```

- [ ] **Step 5: Update `runAnalyticsEffect`**

```typescript
export const runAnalyticsEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const neonRepo = makeNeonAnalyticsRepository(context);
	return runRepoEffect(
		context,
		"analytics",
		effect.pipe(Effect.provideService(IAnalyticsRepository, neonRepo)),
	);
};
```

- [ ] **Step 6: Run tests to verify**

```bash
cd apps/website && pnpm test
```
All tests should pass.
