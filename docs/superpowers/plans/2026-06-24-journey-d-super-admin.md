# Journey D Drill-Down: Super Admin (TDD-Level Tasks)

> Maps to PRD §8.4 (Journey D). Covers: SUP-1 to SUP-15.

Given the breadth of Super Admin functionality, this appendix provides TDD-level tasks for the most critical paths and references for the rest. The complete journey has 15 stages; the critical ones are detailed here.

**Domain folders needed:**
- `apps/website/src/domain/companies/` (reused from C.1)
- `apps/website/src/domain/memberships/` (new)
- `apps/website/src/pages/super-admin/`
- `apps/website/src/components/super-admin/`

---

## E.1 — Super Admin Tenant Provisioning (Stage 1-3 of Journey D)

### Task E.1.1 — `/super-admin/tenants/new` page

**Files:**
- Create: `apps/website/src/pages/super-admin/tenants/new.astro`
- Create: `apps/website/src/components/super-admin/CreateTenantForm.tsx`
- Create: `apps/website/src/pages/api/super-admin/tenants.ts`

**Spec — `CreateTenantForm.tsx`:**

```typescript
import { useState } from "react"
import { Button } from "@treonstudio/bungas-core/ui/button"
import { Input } from "@treonstudio/bungas-core/ui/input"
import { Label } from "@treonstudio/bungas-core/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@treonstudio/bungas-core/ui/select"

type TBillingTier = "starter" | "growth" | "enterprise" | "trial"

type CreateTenantFormProps = {
  readonly onSuccess: (companyId: string) => void
}

export const CreateTenantForm = ({ onSuccess }: CreateTenantFormProps) => {
  const [formData, setFormData] = useState({
    name: "",
    domain: "",
    billingTier: "starter" as TBillingTier,
    sessionQuota: 100,
    contractStartDate: new Date().toISOString().split("T")[0],
    contractEndDate: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/super-admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      const json = await res.json()
      if (json.success) {
        onSuccess(json.data.id)
      } else {
        setError(json.error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form data-testid="create-tenant-form" onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div>
        <Label htmlFor="name">Company name *</Label>
        <Input id="name" data-testid="company-name" value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })} required minLength={2} maxLength={100} />
      </div>
      <div>
        <Label htmlFor="domain">Email domain (optional)</Label>
        <Input id="domain" data-testid="company-domain" placeholder="acme.com"
          value={formData.domain}
          onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
          pattern="[a-z0-9.-]+\.[a-z]{2,}" />
      </div>
      <div>
        <Label htmlFor="billingTier">Billing tier *</Label>
        <Select value={formData.billingTier} onValueChange={(v) => setFormData({ ...formData, billingTier: v as TBillingTier })}>
          <SelectTrigger data-testid="billing-tier"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="growth">Growth</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="sessionQuota">Session quota *</Label>
        <Input id="sessionQuota" data-testid="session-quota" type="number" min="0" max="100000"
          value={formData.sessionQuota}
          onChange={(e) => setFormData({ ...formData, sessionQuota: Number(e.target.value) })} required />
      </div>
      <div>
        <Label htmlFor="contractEndDate">Contract end date</Label>
        <Input id="contractEndDate" data-testid="contract-end" type="date"
          value={formData.contractEndDate}
          onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })} />
      </div>
      {error && <div data-testid="create-tenant-error" className="text-red-500">{error}</div>}
      <Button data-testid="create-tenant-submit" type="submit" disabled={submitting}>
        Create tenant
      </Button>
    </form>
  )
}
```

**Acceptance criteria — see A.5 Stage 1-2:**
- [ ] Super Admin MFA enforced before form access
- [ ] Valid data → tenant created
- [ ] Duplicate name → error
- [ ] Contract end before start → error
- [ ] Invalid domain → error

**Commit:** `feat(super-admin): create tenant form with validation`

### Task E.1.2 — Sales handoff form (SUP-12)

**Files:**
- Create: `apps/website/src/pages/super-admin/handoff.astro`
- Create: `apps/website/src/components/super-admin/HandoffForm.tsx`
- Migration: `handoff_artefacts` table

**Migration:**

```sql
-- apps/website/supabase/migrations/20260625000030_create_handoff_artefacts.sql
create table if not exists public.handoff_artefacts (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  company_name text not null,
  company_size text not null,
  billing_model text not null,
  company_admin_email text not null,
  contract_terms text not null,
  go_live_date date not null,
  sales_contact text not null,
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  provisioning_sla_due_at timestamptz not null
);

alter table public.handoff_artefacts enable row level security;
create policy "super_admins_view_handoffs" on public.handoff_artefacts
  for all using (public.current_user_is_super_admin());
```

**Spec — `HandoffForm.tsx`:**

```typescript
type HandoffFormProps = {
  readonly onSuccess: (artifactId: string) => void
}

export const HandoffForm = ({ onSuccess }: HandoffFormProps) => {
  const [formData, setFormData] = useState({
    companyName: "",
    companySize: "1-50",
    billingModel: "starter",
    companyAdminEmail: "",
    contractTerms: "",
    goLiveDate: new Date().toISOString().split("T")[0],
    salesContact: "",
  })

  // ... similar to CreateTenantForm ...

  return (
    <form data-testid="handoff-form" onSubmit={handleSubmit}>
      {/* All required fields per SUP-12 */}
    </form>
  )
}
```

**Acceptance criteria — see A.5 Stage 1:**
- [ ] All fields required
- [ ] Provisioning SLA: 1 business day
- [ ] Cannot start provisioning without handoff

**Commit:** `feat(super-admin): sales handoff form (SUP-12)`

---

## E.2 — MFA Enforcement (SUP-8)

### Task E.2.1 — MFA gate for super admin actions

**Files:**
- Create: `apps/website/src/lib/mfa-gate.ts`
- Modify: `apps/website/src/middleware/auth.ts`

**Spec — `mfa-gate.ts`:**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js"
import { Data } from "effect"

export class MfaRequiredError extends Data.TaggedError("MfaRequiredError")<{
  readonly message: string
}> {}

export const requireMfa = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<void> => {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new MfaRequiredError({ message: "Not authenticated" })

  const factors = data.user.factors ?? []
  const has2FA = factors.some((f) => f.factor_type === "totp" && f.status === "verified")

  if (!has2FA) {
    throw new MfaRequiredError({
      message: "2FA is required for Super Admin. Please enable it in your account settings.",
    })
  }
}
```

**Integration in super-admin API routes:**

```typescript
// In every /api/super-admin/* route:
import { requireMfa } from "@/lib/mfa-gate"

export const POST = async (context: APIContext) => {
  // ... existing auth check ...

  // Check super admin role
  const { data: membership } = await supabase
    .from("user_company_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .eq("is_active", true)
    .single()

  if (!membership) {
    return jsonError({ _tag: "Forbidden", message: "Super admin only" }, makeMeta(), 403)
  }

  // Enforce MFA
  try {
    await requireMfa(supabase, userId)
  } catch (e: any) {
    return jsonError({ _tag: e._tag ?? "Error", message: e.message }, makeMeta(), 403)
  }

  // ... continue with action ...
}
```

**Test cases — see A.5 Stage 14:**
- [ ] Super admin without 2FA → blocked from admin actions
- [ ] Super admin with 2FA → allowed
- [ ] Emergency suspend works (any super admin can suspend another)

**Commit:** `feat(super-admin): MFA enforcement for all admin actions (SUP-8)`

---

## E.3 — Two-Person Tenant Deletion (SUP-10)

**Reference: C.1.6 for `initiateSoftDeleteProgram`**

### Task E.3.1 — Soft-delete UI

**Files:**
- Create: `apps/website/src/pages/super-admin/tenants/[id]/delete.astro`
- Create: `apps/website/src/components/super-admin/DeleteTenantForm.tsx`
- Create: `apps/website/src/pages/api/super-admin/tenants/[id]/delete.ts`

**Spec — `DeleteTenantForm.tsx`:**

```typescript
type DeleteTenantFormProps = {
  readonly tenantId: string
  readonly tenantName: string
  readonly onInitiated: (confirmationToken: string) => void
}

export const DeleteTenantForm = ({ tenantId, tenantName, onInitiated }: DeleteTenantFormProps) => {
  const [formData, setFormData] = useState({
    reason: "",
    approverEmail: "",
    confirmationName: "",
  })
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.confirmationName !== tenantName) {
      setError("Confirmation name does not match tenant name")
      return
    }

    const res = await fetch(`/api/super-admin/tenants/${tenantId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    })
    const json = await res.json()
    if (json.success) {
      onInitiated(json.data.confirmationToken)
    } else {
      setError(json.error.message)
    }
  }

  return (
    <form data-testid="delete-tenant-form" onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="reason">Reason for deletion *</Label>
        <Textarea id="reason" data-testid="delete-reason" value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })} required minLength={20} />
      </div>
      <div>
        <Label htmlFor="approverEmail">Approver email (second super admin) *</Label>
        <Input id="approverEmail" data-testid="approver-email" type="email"
          value={formData.approverEmail}
          onChange={(e) => setFormData({ ...formData, approverEmail: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="confirmationName">Type the tenant name to confirm *</Label>
        <Input id="confirmationName" data-testid="confirmation-name"
          value={formData.confirmationName}
          onChange={(e) => setFormData({ ...formData, confirmationName: e.target.value })} required />
      </div>
      {error && <div data-testid="delete-error" className="text-red-500">{error}</div>}
      <Button data-testid="delete-submit" type="submit" variant="destructive">
        Initiate soft-delete
      </Button>
    </form>
  )
}
```

**Test cases — see A.5 Stage 11:**
- [ ] Initiate deletion → email sent to approver
- [ ] Approver clicks link → soft-delete applied
- [ ] Reversed within 48h → full restore
- [ ] Only 1 super admin → blocked
- [ ] Legal hold active → blocked
- [ ] Hard delete requires another 2-person after 48h

**Commit:** `feat(super-admin): two-person tenant deletion with 48h window (SUP-10)`

---

## E.4 — Feature Flags (SUP-6)

### Task E.4.1 — `tenant_feature_flags` table + toggle UI

**Files:**
- Migration: `tenant_feature_flags` table
- Create: `apps/website/src/pages/super-admin/tenants/[id]/features.astro`
- Create: `apps/website/src/components/super-admin/FeatureFlagsPanel.tsx`

**Migration:**

```sql
-- apps/website/supabase/migrations/20260625000040_create_tenant_feature_flags.sql
create table if not exists public.tenant_feature_flags (
  company_id uuid not null references public.companies(id) on delete cascade,
  flag text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (company_id, flag)
);

alter table public.tenant_feature_flags enable row level security;
create policy "super_admins_manage_flags" on public.tenant_feature_flags
  for all using (public.current_user_is_super_admin());
```

**Spec — `FeatureFlagsPanel.tsx`:**

```typescript
import { Switch } from "@treonstudio/bungas-core/ui/switch"
import { Card } from "@treonstudio/bungas-core/ui/card"

const ALL_FLAGS = [
  { key: "mood_checkin", label: "Mood check-in (EPIC-14)", phase: 2, critical: false },
  { key: "goals", label: "Goal-setting (EPIC-15)", phase: 2, critical: false },
  { key: "self_guided_content", label: "Self-guided content (EPIC-11)", phase: 2, critical: false },
  { key: "bookmarks", label: "Bookmarks (EPIC-18)", phase: 2, critical: false },
  { key: "skills_library", label: "Skills library (EPIC-19)", phase: 2, critical: false },
  { key: "pulse_survey", label: "Pulse survey (ENG-7)", phase: 2, critical: false },
  { key: "freemium", label: "Freemium tier (EPIC-17)", phase: 2, critical: false },
  { key: "n2cias", label: "N2CIAS assessment (EPIC-08)", phase: 2, critical: true },  // safety flag
  { key: "risk_detection", label: "Risk detection (EPIC-04)", phase: 1, critical: true },  // safety flag
  { key: "low_adoption_alert", label: "Low adoption alert (ADM-11)", phase: 1, critical: false },
] as const

type FeatureFlagsPanelProps = {
  readonly companyId: string
  readonly enabledFlags: ReadonlySet<string>
  readonly onToggle: (flag: string, enabled: boolean) => void
}

export const FeatureFlagsPanel = ({ companyId, enabledFlags, onToggle }: FeatureFlagsPanelProps) => (
  <div data-testid="feature-flags-panel" className="space-y-2">
    {ALL_FLAGS.map((flag) => (
      <Card key={flag.key} className="p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{flag.label}</h3>
          <p className="text-xs text-gray-500">Phase {flag.phase}{flag.critical ? " • Safety-critical" : ""}</p>
        </div>
        <Switch
          data-testid={`flag-${flag.key}`}
          checked={enabledFlags.has(flag.key)}
          onCheckedChange={(checked) => onToggle(flag.key, checked)}
          disabled={flag.critical}  // safety flags require special procedure
        />
      </Card>
    ))}
  </div>
)
```

**Test cases — see A.5 Stage 12:**
- [ ] Toggle standard flag → effective immediately
- [ ] Critical safety flag → disabled in UI (special procedure required)
- [ ] All toggles logged to audit

**Commit:** `feat(super-admin): per-tenant feature flags (SUP-6)`

---

## E.5 — Platform Status Banner (SUP-11)

### Task E.5.1 — `platform_status` table + status banner

**Files:**
- Migration: `platform_status` table
- Create: `apps/website/src/components/PlatformStatusBanner.tsx`
- Create: `apps/website/src/pages/super-admin/status.astro`
- Create: `apps/website/src/pages/api/super-admin/status.ts`

**Migration:**

```sql
-- apps/website/supabase/migrations/20260625000050_create_platform_status.sql
create table if not exists public.platform_status (
  id integer primary key default 1 check (id = 1),  -- singleton
  is_active boolean not null default false,
  title text,
  body text,
  expected_resolution_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.platform_status enable row level security;
create policy "public_view_status" on public.platform_status
  for select using (true);
create policy "super_admins_manage_status" on public.platform_status
  for all using (public.current_user_is_super_admin());
```

**Spec — `PlatformStatusBanner.tsx`:**

```typescript
import { useEffect, useState } from "react"

type TStatus = {
  readonly isActive: boolean
  readonly title: string | null
  readonly body: string | null
  readonly expectedResolutionAt: string | null
}

export const PlatformStatusBanner = () => {
  const [status, setStatus] = useState<TStatus | null>(null)

  useEffect(() => {
    fetch("/api/public/platform-status")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data.isActive) setStatus(d.data)
      })
  }, [])

  if (!status?.isActive) return null

  return (
    <div data-testid="platform-status-banner" className="bg-yellow-100 border-b border-yellow-300 p-3" role="status">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <strong>{status.title}</strong>
          {status.body && <p className="text-sm">{status.body}</p>}
        </div>
        {status.expectedResolutionAt && (
          <span className="text-sm text-yellow-800">
            Expected resolution: {new Date(status.expectedResolutionAt).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  )
}
```

**Test cases — see A.5 Stage 9:**
- [ ] Status published → banner shown to all tenants
- [ ] Body must have expected_resolution_at
- [ ] Status deactivated → banner removed

**Commit:** `feat(super-admin): platform status banner (SUP-11)`

---

## E.6 — Cloudflare Cron Jobs (SUP-14, SUP-15)

### Task E.6.1 — Client health alert cron (SUP-14)

**Files:**
- Create: `apps/website/src/pages/api/cron/client-health.ts`
- Update: `apps/website/wrangler.jsonc` (add cron trigger)

**Update `wrangler.jsonc`:**

```jsonc
{
  // ... existing config ...
  "triggers": {
    "crons": [
      "0 6 * * *"  // Daily at 6 AM UTC
    ]
  }
}
```

**Spec — `client-health.ts`:**

```typescript
import type { APIContext } from "astro"
import { createSupabaseServiceClient } from "@/lib/supabase/service"

export const GET = async (context: APIContext) => {
  // Verify Cloudflare cron secret
  const authHeader = context.request.headers.get("authorization")
  if (authHeader !== `Bearer ${import.meta.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createSupabaseServiceClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  // Get all active tenants
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, domain, contract_start_date")
    .eq("status", "active")
    .not("contract_start_date", "is", null)
    .lte("contract_start_date", thirtyDaysAgo)  // skip new tenants

  for (const company of companies ?? []) {
    // Count active employees in last 30 days
    const { count: totalEmployees } = await supabase
      .from("user_company_memberships")
      .select("user_id, profiles!inner(last_active_at)", { count: "exact", head: true })
      .eq("company_id", company.id)
      .eq("is_active", true)
      .eq("role", "employee")

    const { count: activeEmployees } = await supabase
      .from("user_company_memberships")
      .select("user_id, profiles!inner(last_active_at)", { count: "exact", head: true })
      .eq("company_id", company.id)
      .eq("is_active", true)
      .eq("role", "employee")
      .gte("profiles.last_active_at", thirtyDaysAgo)

    const mau = (activeEmployees ?? 0) / (totalEmployees ?? 1)

    if (mau < 0.10) {
      // Send alert
      await sendLowAdoptionAlert(company, { total: totalEmployees ?? 0, active: activeEmployees ?? 0, mau })
    }
  }

  return new Response("OK")
}
```

**Test cases — see A.5 Stage 7:**
- [ ] < 10% MAU for 30d → email to super admin + sales
- [ ] New tenant (< 30d) → suppressed
- [ ] Tenant marked "engaged" → suppressed

**Commit:** `feat(cron): daily client health alert (SUP-14)`

### Task E.6.2 — 90-day renewal reminder cron (SUP-15)

**Files:**
- Create: `apps/website/src/pages/api/cron/renewal-reminders.ts`

**Spec:**

```typescript
export const GET = async (context: APIContext) => {
  // Verify cron secret
  const authHeader = context.request.headers.get("authorization")
  if (authHeader !== `Bearer ${import.meta.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createSupabaseServiceClient()
  const today = new Date().toISOString().split("T")[0]
  const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split("T")[0]

  // Find contracts ending in exactly 90 days
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, contract_end_date")
    .eq("status", "active")
    .eq("contract_end_date", ninetyDaysFromNow)

  for (const company of companies ?? []) {
    // Compute usage summary
    const { count: activeUsers } = await supabase
      .from("user_company_memberships")
      .select("user_id, profiles!inner(last_active_at)", { count: "exact", head: true })
      .eq("company_id", company.id)
      .eq("is_active", true)
      .gte("profiles.last_active_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())

    // Send email to sales + super admin
    await sendRenewalReminder(company, { activeUsers: activeUsers ?? 0 })
  }

  return new Response("OK")
}
```

**Test cases — see A.5 Stage 8:**
- [ ] Contract end 90d out → email with usage summary
- [ ] Already renewed → suppressed
- [ ] Contract end < 30d → critical alert (escalate)

**Commit:** `feat(cron): 90-day renewal reminder (SUP-15)`

---

## E.7 — Data Incident Report (SUP-7)

### Task E.7.1 — Breach report generator

**Files:**
- Create: `apps/website/src/pages/super-admin/incidents/new.astro`
- Create: `apps/website/src/components/super-admin/IncidentReportForm.tsx`
- Create: `apps/website/src/pages/api/super-admin/incidents.ts`

**Spec — `IncidentReportForm.tsx`:**

```typescript
import { useState } from "react"

type IncidentReportFormProps = {
  readonly onSuccess: (pdfUrl: string) => void
}

export const IncidentReportForm = ({ onSuccess }: IncidentReportFormProps) => {
  const [formData, setFormData] = useState({
    incidentDate: "",
    affectedDataTypes: [] as string[],
    estimatedScope: "",
    timeline: "",
    mitigationSteps: "",
  })
  const [error, setError] = useState<string | null>(null)

  // 72h check
  const validate72h = (): string | null => {
    if (!formData.incidentDate) return null
    const incidentTime = new Date(formData.incidentDate).getTime()
    const now = Date.now()
    const hoursSince = (now - incidentTime) / (1000 * 60 * 60)
    if (hoursSince > 72) {
      return "Incident is more than 72 hours old. UU PDP Art. 46 requires notification within 72 hours — escalate to Legal."
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const error72 = validate72h()
    if (error72) {
      setError(error72)
      return
    }

    const res = await fetch("/api/super-admin/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    })
    const json = await res.json()
    if (json.success) {
      onSuccess(json.data.pdfUrl)
    } else {
      setError(json.error.message)
    }
  }

  return (
    <form data-testid="incident-report-form" onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div>
        <Label htmlFor="incidentDate">Incident date/time *</Label>
        <Input id="incidentDate" data-testid="incident-date" type="datetime-local"
          value={formData.incidentDate}
          onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })} required />
      </div>
      <div>
        <Label>Affected data types *</Label>
        <div className="space-y-1">
          {["user_profiles", "chat_history", "risk_flags", "memberships"].map((type) => (
            <label key={type} className="flex items-center gap-2">
              <input
                type="checkbox"
                data-testid={`data-type-${type}`}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...formData.affectedDataTypes, type]
                    : formData.affectedDataTypes.filter((t) => t !== type)
                  setFormData({ ...formData, affectedDataTypes: next })
                }}
              />
              {type}
            </label>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="estimatedScope">Estimated scope *</Label>
        <Textarea id="estimatedScope" data-testid="scope" value={formData.estimatedScope}
          onChange={(e) => setFormData({ ...formData, estimatedScope: e.target.value })} required minLength={20} />
      </div>
      <div>
        <Label htmlFor="timeline">Timeline *</Label>
        <Textarea id="timeline" data-testid="timeline" value={formData.timeline}
          onChange={(e) => setFormData({ ...formData, timeline: e.target.value })} required minLength={50} />
      </div>
      <div>
        <Label htmlFor="mitigationSteps">Mitigation steps *</Label>
        <Textarea id="mitigationSteps" data-testid="mitigation" value={formData.mitigationSteps}
          onChange={(e) => setFormData({ ...formData, mitigationSteps: e.target.value })} required minLength={50} />
      </div>
      {error && <div data-testid="incident-error" className="text-red-500">{error}</div>}
      <Button data-testid="incident-submit" type="submit">Generate report</Button>
    </form>
  )
}
```

**Test cases — see A.5 Stage 13:**
- [ ] Complete form → PDF generated
- [ ] < 72h since breach → can generate
- [ ] > 72h since breach → blocked, escalate message
- [ ] Auto-redaction of PII in output

**Commit:** `feat(super-admin): data incident report generator (SUP-7)`

---

## E.8 — Journey D E2E Test Suite

### Task E.8.1 — Playwright tests for Journey D

**Files:**
- Create: `apps/website/tests/e2e/journey-d-super-admin.spec.ts`

**Spec — 10 scenarios from A.7:**

```typescript
import { test, expect } from "@playwright/test"

test.describe("Journey D: Super Admin", () => {
  test("happy path: handoff form → provision → invite admin → go-live verified", async ({ page }) => { /* ... */ })
  test("duplicate company: name conflict → ONB-4 error", async ({ page }) => { /* ... */ })
  test("SLA breach: > 1 BD provisioning → internal alert", async ({ page }) => { /* ... */ })
  test("activation watch: admin doesn't accept in 48h → alert", async ({ page }) => { /* ... */ })
  test("go-live verification: all checklist items → mark live", async ({ page }) => { /* ... */ })
  test("client health alert: < 10% MAU 30d → email", async ({ page }) => { /* ... */ })
  test("renewal reminder: 90d out → email", async ({ page }) => { /* ... */ })
  test("platform status: publish → banner on all tenant pages", async ({ page }) => { /* ... */ })
  test("soft-delete: two-person confirm → 48h window → restore → confirm hard delete", async ({ page }) => { /* ... */ })
  test("MFA enforcement: super admin without 2FA → blocked from admin actions", async ({ page }) => { /* ... */ })
})
```

**Run:** `pnpm playwright test journey-d-super-admin`
**Expected:** All 10 PASS

**Commit:** `test(e2e): Journey D comprehensive test suite (10 scenarios)`

---

## E.9 — Journey D Acceptance Criteria Summary

| PRD Story | Implementation | Test |
|---|---|---|
| SUP-1 | E.1.1 | C.1.4 + E.1.1 |
| SUP-2 | (Phase 2 cross-tenant dashboard) | Phase 2 |
| SUP-3 | (memberships) | Unit |
| SUP-4 | (audit log) | Unit + E2E |
| SUP-5 | (Phase 1.8.x) | Unit |
| SUP-6 | E.4.1 | Unit |
| SUP-7 | E.7.1 | Unit |
| SUP-8 | E.2.1 | E.8 MFA test |
| SUP-9 | (Phase 1.8) | Unit |
| SUP-10 | E.3.1 | E.8 soft-delete test |
| SUP-11 | E.5.1 | E.8 platform status test |
| SUP-12 | E.1.2 | E.8 happy path |
| SUP-13 | (Phase 1.8.x activation watch) | E.8 activation test |
| SUP-14 | E.6.1 | E.8 client health test |
| SUP-15 | E.6.2 | E.8 renewal test |

**Journey D is "shipped" when:** All E.x tasks committed, all unit tests pass, all E.8 E2E pass.
