# Product Requirements Document
## Tenang for Business -- AI-Powered Mental Wellness for Enterprises

| | |
|---|---|
| **Document Owner** | Chief Product Officer |
| **Status** | Draft v1.1 -- for review |
| **Source Material** | Internal SRS / Developer Documentation (Tenang AI, Mayapada Mental Wellness, N2CIAS, AI Engine) v1.0.0 Feb 2026; Competitive research (Talkspace, Limbic, Woebot) Jun 2026 |
| **Last Updated** | 22 June 2026 |
| **Audience** | Engineering, Design, Clinical/Ops, Sales, Leadership |

---

## 1. Why This Document Exists

**Tenang** is the product -- an AI-powered mental wellness platform with both a direct-to-consumer (B2C) app and a growing enterprise (B2B) line. **"Tenang for Business" is the B2B line within that product**, not a separate company or rebrand.

**Mayapada Hospital is one client on that B2B line** -- the most mature one, but not the only one this product is meant to serve. The source SRS documents the Mayapada engagement in the most depth (it has its own branded `mayapada-web`), which can make it read like the whole system was purpose-built around one hospital. It wasn't architecturally -- multi-tenant primitives (`company_id`, per-company billing, per-company analytics) already exist in the codebase. What's missing is the **discipline to onboard the next client without a one-off engineering effort each time**.

This PRD's job: turn "Tenang for Business" into a real, sellable product line that counts Mayapada among its clients -- not a hospital-specific build that Mayapada's success is mistaken for.

---

## 2. Executive Summary

**Product:** Tenang for Business -- the enterprise line of the Tenang mental wellness platform. Gives companies a branded, AI-powered mental wellness chat (an "AI co-psychologist") for their employees, with HR-facing admin tools, usage analytics, risk alerting, and consumption-based billing.

**Core insight:** Three things already exist in the codebase that most EAP competitors build from scratch -- (1) AI conversational psychologist with persistent memory, (2) per-session and cross-session risk/red-flag detection, (3) multi-tenant billing engine. The job now is **productization**, not invention.

**Primary buyer:** HR / People Ops leaders at mid-to-large companies.

**Wedge:** Lower cost-per-employee than human-counselor EAPs, instant 24/7 availability, and a usage dashboard HR has never had before.

---

## 3. Problem Statement

| Stakeholder | Problem Today |
|---|---|
| **HR / People Ops** | Traditional EAP benefits have <5% utilization, no usage data, slow onboarding, per-seat pricing regardless of usage |
| **Employees** | Stigma and scheduling friction stop people seeking help. Days waiting for an appointment when distress is acute |
| **Tenang (the business)** | B2B capability is fragmented and client-coupled -- separate stacks, a separate assessment brand, and Mayapada's own bespoke app. No single onboarding flow for a new company |

---

## 4. Competitive Landscape

### 4.1 Talkspace for Employers -- direct competitor

Three-tier model: self-guided app with 70+ programs, 1:1 therapy with licensed therapists (live video and async), and psychiatry with prescribing authority within 2 weeks. Employer portal ("Talkspace Engage") with usage metrics. Published outcome data: ~50% fewer missed work hours, 36% higher productivity, 39% better work-life balance after 12 weeks. No public pricing -- demo-gated, like our Phase 1 plan.

**Key difference:** Talkspace is human-clinician-heavy at its core. Tenang is AI-first with human escalation reserved for high-risk cases -- structurally lower cost per employee, but without Talkspace's depth of published clinical outcome data yet.

### 4.2 Limbic Care -- adjacent, not a direct competitor

Sold to behavioral health providers and health systems (including NHS), not employers. AI companion between scheduled therapy sessions. Published outcomes: 23% fewer patient dropouts, 40% fewer sessions to reach standard of care, 21% increase in reliable recovery. Sibling product "Limbic Access" for AI-assisted intake/assessment -- structurally similar to N2CIAS (EPIC-08). Recently launched an AI "scribe" for clinical documentation -- pattern adopted as RISK-8 in this PRD.

### 4.3 Woebot Health -- cautionary, validating signal

Shut down direct-to-consumer app 30 June 2025. Now operates purely B2B -- employers, health plans, providers. Repositioned as regulated Software as a Medical Device. Explicitly does NOT provide real-time crisis intervention. This validates Tenang's approach: a clear human-staffed escalation path (EPIC-04) is safer and better validated than "AI handles everything including crises."

Woebot's payroll-platform distribution channel (partnership with PayrollPlans) is a Phase 3 GTM idea: partner with an Indonesian payroll/HRIS platform to reach SMB clients direct sales won't serve efficiently.

### 4.4 Comparison Summary

| Dimension | Talkspace | Limbic | Woebot | Tenang for Business |
|---|---|---|---|---|
| Sold to | Employers (HR) | Clinics / health systems | Employers, payers, providers | Employers (HR) |
| Core mechanism | Licensed human therapists + self-guided app | AI companion between therapy sessions | AI chat (regulated SaMD) | AI chat + human escalation for risk |
| Self-guided content | Yes (70+ programs) | Yes (CBT courses) | N/A (B2B-only model) | EPIC-11 (Phase 2) |
| Employer admin console | Yes (Talkspace Engage) | No | Limited | Yes (EPIC-05) |
| Real-time crisis handling | Licensed therapists | Clinician-supervised | Explicitly avoided | AI detects, human team escalates (EPIC-04) |

---

## 5. Product Vision

> *Every employee at every company should have a confidential, judgment-free AI mental health companion available in under 30 seconds -- and every HR leader should be able to see, in aggregate anonymized form, whether their workforce is okay, without ever reading a single transcript.*

**Strategic pillars:**
1. Self-serve B2B onboarding -- a company goes live without engineering involvement
2. One product, not three -- unify B2C chat, B2B chat, and N2CIAS under one tenant model
3. Trust as the moat -- data isolation, anonymization by default, clear human escalation
4. Usage-based monetization -- quota + pay-as-you-go billing

---

## 6. Goals & Success Metrics

| Goal | Metric | Target (12 months post-launch) |
|---|---|---|
| Expand B2B client base beyond Mayapada | # active paying enterprise tenants | 15 companies |
| Drive utilization | Monthly active employees / total invited | >=25% (vs industry EAP ~5%) |
| Retain enterprise accounts | Logo retention at 12 months | >=90% |
| Prove clinical/safety value | Median time from red-flag to human follow-up | <24 hours |
| Healthy unit economics | Gross margin per tenant | >=65% |
| HR adoption of admin tools | % admins viewing dashboard monthly | >=80% |

---

## 7. Target Users & Personas

### 7.1 Platform Super Admin ("Tenang Ops")
Tenang's own platform team. Provisions all enterprise tenants (Mayapada and every client after), sets platform-wide policy, manages billing configuration across tenants, cross-client business metrics -- never individual employee identity or transcript. Exists as `SUPER_ADMIN_ROLE` in the codebase but has no dedicated console today. See EPIC-09.

### 7.2 Company Admin / HR Lead ("Dewi")
Admin/HR contact at a client company. Scoped to their own company only. Invites employees, sees aggregate analytics, manages quota/billing within Super Admin-configured limits.

### 7.3 Employee ("Budi")
Anonymous-feeling, time-pressed, possibly skeptical of "company-provided" tools. Needs privacy assurance, instant access, feels heard -- not a scripted bot.

### 7.4 Clinical/Ops Staff ("Internal Staff")
Reviews red-flag alerts and manages escalation. This is a B2B product sold to companies, not clinics. Clinical/Internal Staff is **Tenang's own platform-side resource**, shared across every client -- the same way a traditional EAP vendor's counselors work for the vendor, not for each company that buys the benefit.

---

## 8. User Journeys

The four journeys below cover the primary happy path for each persona. Section 8.5 is a cross-role stress test: every boundary condition, handover, and failure state that falls between or beyond the four main journeys. All confirmed gaps from the stress test have been resolved -- either as new user stories in Section 8.6, a new policy note, or an explicit accepted risk.

### 8.1 Journey A -- Employee: Invitation to Ongoing Use

| Stage | Action | Touchpoint | Gap Fixed | Risk if This Fails |
|---|---|---|---|---|
| 1. Awareness | Receives a clear human-written invitation email that explains what Tenang is, what it is not (not therapy, not a crisis line), and that conversations are private from the employer | Email with defined content (EMP-16) | A-1: invitation content was undefined | Generic corporate email = ignored; unclear privacy claim = ignored |
| 2. Registration | Clicks link; if employee already has a B2C Tenang account with the same email, sees an explanation of how B2B and B2C accounts stay separate | /register + B2C conflict screen (EMP-17) | A-10: B2C/B2B same-email conflict | Employee thinks employer can see personal B2C conversations |
| 3. Verification | Enters OTP code | /verify-otp | -- | Delayed OTP = abandonment |
| 4. Profile setup | Completes short profile (age range, etc.) | /update-profile | -- | Too much personal info erodes trust |
| 4b. Orientation | Sees a one-screen explainer: what AI can do, what it cannot do, what stays private -- shown once before first chat | Onboarding screen (EMP-16) | A-2: no orientation screen existed | First session starts with misaligned expectations; employee expects crisis response or therapy |
| 5. First chat | Starts conversation; AI opens with a first-time-user welcome that sets context and tone, not a generic "how can I help?" | /chat + first-session protocol (CHAT-13) | A-3: AI first message was undefined | Cold or generic opener = trust lost before conversation begins |
| 5b. Crisis moment (conditional) | If AI detects high risk: a crisis resource card appears as a persistent non-disruptive in-chat banner; session continues unless employee chooses to end it; on-call clinical staff paged simultaneously | In-chat crisis banner (CHAT-16) + RISK-15/RISK-17 | A-6/A-7: employee experience during a risk flag was undefined | Abrupt session termination at the worst possible moment = trust destroyed permanently |
| 5c. Case open -- employee silence gap (conditional) | Employee whose session was flagged receives no feedback while the case is open (RISK-16 covers case close); platform does not say "help is coming" unless a human has acknowledged the page | No UI change beyond crisis card; RISK-15 on-call acknowledgement logic | A-8: employee left in silence between flag and resolution | Employee thinks nobody saw; feels abandoned during an acute moment |
| 6. Post-session | After every session ends: brief AI-generated summary, optional mood check-in prompt, one content or skill recommendation | Post-session screen (CHAT-14) | A-4: post-chat experience was undefined | Session feels inconclusive; lower return rate |
| 7. Ongoing use | Returns for future sessions; AI recalls prior context and goals | /chat + Mem0 | -- | Memory failure = "it doesn't remember me" |
| 7b. Return after long absence | Returns after 30+ days; AI acknowledges the gap warmly without pressure | Re-engagement state (CHAT-15) | A-5: long-absence return was undefined | Cold restart without acknowledgement = feels like starting from scratch; guilt about being away |
| 8. Quota exhausted (conditional) | Tries to start a session when company quota is at 0; sees a clear message explaining why and what to do (contact HR) -- not a broken screen | Quota-exhausted screen (BILL-4) | A-9: quota exhaustion had no path in the journey | Employee thinks the app is broken; never returns |

### 8.2 Journey B -- Company Admin: Contract to Renewal

| Stage | Action | Touchpoint | Gap Fixed | Risk if This Fails |
|---|---|---|---|---|
| 1. Evaluation | Compares against incumbent EAP vendors | Sales conversation / demo | -- | Vague answers on data privacy kill the deal |
| 1b. Contract signed | Signs contract; Sales completes a standardised handoff form (company size, billing model, Company Admin contact, go-live date) and routes it to Super Admin | Handoff form (SUP-12) | B-1: no contract or handoff stage existed | Wrong billing model configured; wrong admin invited; no committed provisioning timeline |
| 2. Setup | Tenant provisioned by Super Admin within one business day of handoff form; Company Admin receives credentials with a "getting started" guide | Super Admin console (SUP-13) + onboarding guide | B-2: no admin onboarding existed | Admin goes from "received credentials" to "upload logo" with no guidance |
| 3. Branding | Uploads logo, sets brand color, configures welcome message and employee invitation email content | Admin console (EPIC-10) | -- | Unbranded invites feel less credible internally |
| 4. Rollout | Previews and confirms bulk-invite list (ONB-9); sends invitations alongside an internal comms kit (announcement email, FAQ template) Tenang provides | Admin console + comms kit | B-3: no internal comms guidance existed | Employees receive an unexplained link and ignore it; low activation rate |
| 5. Monitoring | Receives a proactive notification if utilization drops below threshold for two consecutive weeks; checks dashboard in response to alerts, not just periodically | Analytics Dashboard + ADM-11 proactive alert | B-4: monitoring was passive (admin had to remember to check) | Low adoption discovered at renewal, not when it could still be fixed |
| 5b. Low adoption response (conditional) | If adoption is below 10% at Day 30, receives a suggested action from Tenang (campaign kit, reminder announcement via ENG-3) | ADM-11 alert + action suggestion | B-5: no low-adoption path existed | Most common EAP failure mode had no intervention path |
| 6. Risk visibility | Reviews aggregate anonymized red-flag counts | Dashboard | -- | Over-exposure breaks employee trust; under-visibility breaks her trust in vendor |
| 7. Billing | Reviews quota usage and gets warned near limit; has a shared activity log with co-admins (ADM-12) | Billing module + ADM-12 activity log | -- | Unexpected overage + no visibility into what a co-admin changed |
| 8. Renewal trigger | 90 days before contract end, receives a usage summary and renewal reminder proactively from Tenang | SUP-15 renewal trigger routed to Company Admin + Sales | B-6: no platform-side renewal trigger existed | Renewal conversation starts cold; no lead time; contract lapses unnoticed |
| 9. Renewal | Pulls usage report with benchmark comparison (EPIC-16) to defend budget to leadership | QBR / dashboard export (ADM-5) + WFA-1 benchmark | -- | No comparative data = renewal relies on gut feel, not evidence |

### 8.3 Journey C -- Clinical/Internal Staff: Flag to Resolution

| Stage | Action | Touchpoint | Gap Fixed | Risk if This Fails |
|---|---|---|---|---|
| 0. Alert | Receives immediate push + email notification when a new flag appears in queue; does not need to monitor dashboard passively | RISK-17 notification | C-1: no notification mechanism existed | Flags sit unreviewed; triage queue is invisible; SLA breached before anyone looks |
| 1. Detection | Flag appears in the clinical staff's queue with an AI-generated summary (RISK-8) | Risk queue dashboard | -- | Too many false positives = real flags ignored |
| 2a. Triage -- escalate | Reviews anonymized case; decides to escalate; assigns to a specific named psychologist from Tenang's team | Risk queue + assignment (RISK-18) | C-2/C-3: no dismiss path; psychologist experience undefined | Unowned assignment disappears into a shared queue |
| 2b. Triage -- dismiss | Decides flag is a false positive; marks with a reason code; case logged for detection model tuning | RISK-4 dismiss action | C-2: dismiss path was missing from the journey | No dismiss path forces escalation of everything; clinical team overwhelmed |
| 3. Shift handover (conditional) | If shift ends with an open case, clinical staff adds a handover note and confirms backup assignee is aware | RISK-10 backup assignee + handover note field | C-7: shift handover had no documented mechanism | Case becomes ownerless at shift change |
| 4. Cross-case pattern check | If two or more employees from the same company are flagged in the same 7-day window, clinical staff receives a pattern alert | RISK-11 chronic risk indicator extended to company-level pattern | C-8: no mechanism to notice systemic company issues | Toxic team / major org change goes undetected at population level |
| 5. Psychologist follow-up | Psychologist (Journey E) makes contact; logs outcome in the case record | See Journey E | C-3/C-4: psychologist flow was a black box | No structured log; no proof the employee was actually reached |
| 5b. Re-escalate (conditional) | If psychologist determines situation is more serious than triaged: routes to emergency services (RISK-12) or senior clinical review | RISK-12 emergency action + RISK-19 unreachable protocol | C-5: no re-escalation path after follow-up existed | Psychologist has no formal mechanism to act on a worse-than-expected situation |
| 6. Resolution | Case marked resolved by an authorised role (senior clinical staff or above); resolution reason required | RISK-20 resolution authority | C-6: resolution authority was undefined | Compliance gap; any staff member could close any case with no sign-off |
| 7. Outcome tracking | Case outcome monitored for 30 days: return to chat, mood trend, content engagement | RISK-9 outcome tracking | -- | Clinical team cannot improve; no data for case studies |

### 8.4 Journey D -- Super Admin: New Client to Steady State

| Stage | Action | Touchpoint | Gap Fixed | Risk if This Fails |
|---|---|---|---|---|
| 0. Handoff received | Sales submits a completed handoff form with: company name, size, billing model, Company Admin contact, contract terms, go-live date | Handoff form (SUP-12) | D-1: no standardised handoff artefact existed | Wrong billing model; wrong admin invited; provisioning starts on incomplete information |
| 1. Provisioning | Creates company record within one business day of handoff; sets billing model, quota, and branding defaults | Super Admin console + provisioning SLA (SUP-13) | D-2: no SLA for provisioning existed | Company Admin waits days with no communication; trust damaged at the start |
| 2. Admin handoff | Invites client's first Company Admin with a getting-started guide; starts a 48h activation watch | Email invite + activation watch (SUP-13) | D-3: no activation check existed | Admin invitation bounces or is ignored; nobody notices until the first QBR |
| 3. Go-live verification | Confirms: Company Admin has logged in, configured branding, sent at least one invitation batch, first employee has registered | Go-live checklist (SUP-13) | D-5: no go-live verification existed | Client technically provisioned but operationally dead; discovered weeks later |
| 4. Steady state | Monitors cross-tenant health: uptime, aggregate utilization, billing across all tenants | Super Admin dashboard (SUP-2) | -- | Without anonymization boundary Super Admin role becomes privacy liability |
| 5. Client health alert (conditional) | Receives automated alert when a client's utilization has been below threshold for 30 consecutive days | SUP-14 client health alert | D-4 partial: proactive churn signal existed only at company admin level (ADM-11); Super Admin now also alerted | Churn discovered at renewal, too late to intervene |
| 6. Renewal signal | 90 days before contract end, sends a usage summary to Sales + Company Admin; tracks renewal outcome | SUP-15 renewal trigger | D-4: no renewal stage existed in Journey D | Contract lapses unnoticed; Sales has no lead time; client churns without a conversation |

### 8.5 Journey E -- Psychologist: Case Assignment to Closure

*New journey. The psychologist was previously undocumented -- mentioned as the destination of an escalation but with zero workflow detail. This fixes gap C-3.*

| Stage | Action | Touchpoint | Risk if This Fails |
|---|---|---|---|
| 1. Assignment notification | Receives an immediate push + email notification when a case is assigned by Clinical Staff; notification includes the AI summary (RISK-8) -- not the full transcript | RISK-18 assignment notification | No notification = psychologist doesn't know they have a case; SLA missed |
| 2. Case review | Opens the case record; reads AI summary and optionally the full anonymized session transcript; notes the employee's risk tier (standard vs critical) | Case record view | Insufficient context = unprepared for the call; over-exposure = privacy breach |
| 3. First contact attempt | Attempts to contact the employee using the contact details on the case record (phone, or Tenang-mediated message if available); logs the attempt with timestamp | Follow-up log on case record | No structured log = no audit trail; no way to prove contact was attempted |
| 3b. Employee unreachable (conditional) | If no response after 3 attempts within 48h, triggers the unreachable protocol: case escalated to senior clinical staff for a decision | RISK-19 unreachable protocol | No protocol = case stays open indefinitely or is silently abandoned |
| 4. Follow-up conversation | Makes contact with the employee; conducts a structured, brief check-in; assesses current risk level | Out-of-band (phone); outcome logged in case record | Unstructured conversation = no comparable data; no audit trail for outcome |
| 4b. Re-escalation (conditional) | If conversation reveals situation is more serious than initially triaged (e.g., imminent self-harm, needs hospitalization): activates emergency services protocol (RISK-12) or routes back to senior clinical staff | RISK-12 emergency action | No re-escalation path = psychologist cannot formally act on a worse-than-expected situation |
| 5. Skill/content assignment (optional) | Assigns a specific skill (SKL-6) or content program (CONT-5) as part of the follow-up plan; recorded in the case record | Skill assignment (SKL-6) | Skipped = follow-up is only a conversation with no ongoing reinforcement |
| 6. Outcome logging | Documents the follow-up outcome: employee reached / unreachable / referred / emergency services called / no further action; marks case as ready for resolution | Case outcome field | Missing log = the resolution authority (RISK-20) cannot make an informed decision to close |
| 7. Resolution handoff | Routes case to senior clinical staff or Clinical Ops for formal resolution sign-off (RISK-20) | RISK-20 resolution authority | Psychologist self-closes case = no independent review; compliance gap |

---

### 8.6 Cross-Role Stress Test -- Gap Analysis

Walking all four journeys end-to-end simultaneously to find what falls between them.

**Classification:** [COVERED] = existing story | [GAP-STORY] = new story added in 8.6 | [GAP-POLICY] = written policy required | [ACCEPTED RISK] = consciously out of scope

---

**Category 1: Employee Lifecycle**

| # | Scenario | Status | Resolution |
|---|---|---|---|
| 1.1 | Employee changes their work email mid-tenure | [GAP-STORY] | EMP-10: email change with re-verification |
| 1.2 | Employee wants to pause use temporarily without deleting account | [GAP-STORY] | EMP-11: "take a break" mode -- pauses notifications, preserves data |
| 1.3 | Employee is mid-chat when company subscription expires | [GAP-STORY] | BILL-8: active session completes before quota-block kicks in |
| 1.4 | Employee leaves company -- what happens to their chat history? | [GAP-POLICY] | TEN-3 must specify data deleted after X days post-deactivation or held for legal hold. Employee gets no portable copy by default. Must be in ToS. |
| 1.5 | Employee wants B2C transition after leaving the company | [ACCEPTED RISK] | Out of scope V1/V2. Complex legal question about data ownership. File for Phase 3. |
| 1.6 | Two employees share a device (factory floor shared tablet) | [GAP-STORY] | EMP-12: prominent one-tap logout always visible |
| 1.7 | Invitation link forwarded to a non-employee | [COVERED] | EMP-7: registration rejected if email not in invitation record |
| 1.8 | Employee registers twice with two different emails | [GAP-STORY] | EMP-13: heuristic duplicate detection at profile level, flagged for manual review |
| 1.9 | Employee is a minor (under 18) in the company's roster | [GAP-POLICY] | Platform is not designed for minors. ToS must prohibit employers from inviting employees under 18. Age declaration at registration. Must be explicit in the written policy. |
| 1.10 | Employee chats in a language the AI doesn't handle well | [ACCEPTED RISK] | Multi-language is Phase 3. V1 supports Bahasa Indonesia and English only. Invitation email should state this clearly. |

**Category 2: Company Admin Lifecycle**

| # | Scenario | Status | Resolution |
|---|---|---|---|
| 2.1 | Company Admin leaves the company -- no other admin exists | [GAP-STORY] | ADM-8: Super Admin can reassign admin role; system warns when only one active admin |
| 2.2 | Admin accidentally sends CSV with all wrong emails | [GAP-STORY] | ONB-9: bulk-invite preview + confirm step before emails send |
| 2.3 | Admin accidentally deactivates all employees at once | [GAP-STORY] | EMP-14: bulk deactivation >20% of roster requires Super Admin confirmation |
| 2.4 | Company Admin changes roles internally, should no longer be admin | [GAP-STORY] | ADM-9: self-service admin role transfer to a colleague |
| 2.5 | Company A acquires Company B -- two tenants need merging | [ACCEPTED RISK] | Out of scope V1/V2. Super Admin handles manually as support operation. Document as known limitation in enterprise contracts. |
| 2.6 | Admin wants to block certain content categories for employees | [ACCEPTED RISK] | Intentionally not supported. Tenang controls content via clinical review (SKL-7). Employer interference in clinical content is explicitly prohibited by design. |
| 2.7 | Admin needs to report a data breach to their own DPO | [GAP-STORY] | SUP-7: Super Admin generates a data incident report for a tenant within 72h (UU PDP Art. 46) |
| 2.8 | Admin wants to segment analytics by location, not just department | [ACCEPTED RISK] | Location dimension deferred to Phase 3. |
| 2.9 | Admin wants to run a company-wide wellbeing pulse survey | [GAP-STORY] | ENG-7: Company Admin can send a 3-question anonymous pulse survey |

**Category 3: Clinical Staff Lifecycle**

| # | Scenario | Status | Resolution |
|---|---|---|---|
| 3.1 | Clinical staff is the only person on shift and becomes unavailable mid-escalation | [GAP-STORY] | RISK-10: every case must have a backup assignee; auto-routes after 15min no acknowledgement |
| 3.2 | Same employee is repeatedly escalated (chronic high-risk) | [GAP-STORY] | RISK-11: chronic-risk indicator distinguishes repeated pattern from first-time flag |
| 3.3 | Employee explicitly refuses follow-up contact | [GAP-POLICY] | Platform cannot force contact. Staff must log the refusal. Policy must define when refusal can be overridden (imminent danger). Must cite Indonesian clinical ethics standards. |
| 3.4 | Situation requires emergency services (ambulance, police) | [GAP-STORY] | RISK-12: explicit "escalate to emergency services" action in critical-risk queue with 119 checklist. Currently completely absent from the SRS. |
| 3.5 | Two clinical staff members open same escalation case simultaneously | [GAP-STORY] | RISK-13: case locking -- one staff claims a case; second sees read-only with "claimed by X" |
| 3.6 | Clinical staff personally acquainted with the employee | [GAP-POLICY] | Conflict-of-interest protocol: staff must declare and recuse; case reassigned. Staffing/operations process, not engineering. |
| 3.7 | Clinical staff member leaves Tenang -- open cases need transferring | [GAP-STORY] | RISK-14: deactivation blocked until all open cases are reassigned |
| 3.8 | Employee reveals employer's illegal activity during a chat | [GAP-POLICY] | Clinical staff cannot act as legal authority. Policy must state: information not shared with employer; employee advised to contact authorities; data retention policy applies regardless. Must be reviewed by Legal. |
| 3.9 | Clinical staff receives a legal subpoena requesting chat records | [GAP-POLICY] | Legal hold process needed. Engineering dependency: TEN-6 legal-hold flag added in Section 8.6. |

**Category 4: Super Admin Lifecycle**

| # | Scenario | Status | Resolution |
|---|---|---|---|
| 4.1 | Super Admin account is compromised | [GAP-STORY] | SUP-8: MFA mandatory; any Super Admin can emergency-suspend another |
| 4.2 | Two Super Admins make conflicting configuration changes simultaneously | [GAP-STORY] | SUP-9: optimistic locking on tenant config; conflict alert shows what changed and by whom |
| 4.3 | Client requests data export to migrate to a competitor | [GAP-POLICY] | Data portability under UU PDP: Tenang must provide machine-readable export within reasonable timeframe. Export format must be defined before first enterprise contract is signed. |
| 4.4 | Super Admin accidentally deletes a client tenant | [GAP-STORY] | SUP-10: tenant deletion requires two-person confirmation + 48h soft-delete window |
| 4.5 | Platform goes down during peak hours affecting all tenants | [GAP-STORY] | SUP-11: Super Admin can publish a platform-wide status message in-app |
| 4.6 | Law enforcement requests access to employee chat data | [GAP-POLICY] | Tenang Legal is the only authorised responder. No data shared without valid court order. Employee notified where legally permissible. Must be in written policy and enterprise contract. |
| 4.7 | Pricing changes mid-contract for an existing client | [GAP-STORY] | BILL-9: Super Admin can schedule a billing tier change with a future effective date |

**Category 5: Cross-Role Handover Gaps**

| # | Scenario | Status | Resolution |
|---|---|---|---|
| 5.1 | Employee is in acute crisis at 3am with no clinical staff on duty | [GAP-STORY] | RISK-15: crisis flag outside staffed hours triggers crisis resource card in-chat immediately AND pages on-call. Platform never implies help is coming if no human has acknowledged. |
| 5.2 | Escalation case closed by clinical team but employee doesn't know | [GAP-STORY] | RISK-16: employee receives a non-alarming in-app message when case is closed |
| 5.3 | Company Admin is also an employee who wants to use the chat | [GAP-STORY] | EMP-15: both roles can coexist on one account; clear role-switcher; admin's chat data follows same privacy rules as any other employee |
| 5.4 | Clinical staff wants to refer an employee to an external provider | [GAP-POLICY] | External referral out of scope technically. Staff can document referral in case record. Written policy must clarify Tenang's clinical team does triage and first response only -- not ongoing therapy. |
| 5.5 | Employee complains to Company Admin about their chat experience | [GAP-STORY] | ADM-10: Company Admin can raise a support ticket on behalf of an employee without seeing chat content |
| 5.6 | Super Admin needs to view a tenant's configuration for support | [COVERED] | TEN-4: time-limited, logged support-access mode |
| 5.7 | Employee triggers false-positive risk flags repeatedly due to writing style | [COVERED] | RISK-4: false positive dismiss with reason code feeds detection tuning |
| 5.8 | Company Admin wants to know if a specific employee is using the app (welfare check) | [ACCEPTED RISK] | Explicitly prohibited by design (RISK-3). Must be stated in Company Admin ToS. The correct path for a genuine welfare concern is a direct conversation with that employee -- not platform surveillance. |
| 5.9 | Employee uses the chat to make threats against a colleague or employer | [GAP-POLICY] | Threat assessment protocol: clinical staff assesses credibility; credible threats may override normal privacy boundary (duty to warn/protect). Legal must define disclosure threshold. Must be in the written policy. |

---

### 8.7 New User Stories from Stress Test

All [GAP-STORY] items from Section 8.5 added to their respective epics.

**EPIC-01 additions:**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| ONB-9 | As a Company Admin, I want to preview and confirm a bulk-invite list before the emails actually send, so that a CSV mistake can be caught before hundreds of wrong people receive an invitation. | Preview step shows count, first 10 rows, and flagged anomalies (duplicates, non-company-domain emails); single confirm action sends all |

**EPIC-02 additions:**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| EMP-10 | As an employee, I want to change my registered email address and re-verify, so that a company email domain change does not lock me out of my account history. | New email verified via OTP before change takes effect; old email receives a security notification |
| EMP-11 | As an employee, I want to pause my account temporarily without deleting it, so that I can take a break without losing my history or needing to re-register. | Pause suspends all notifications (EPIC-12); data and history fully preserved; paused accounts excluded from MAU count; employee can unpause at any time |
| EMP-12 | As an employee on a shared device, I want a prominent one-tap logout always visible, so that a colleague cannot see my conversations on the same device. | Logout always visible in the header; session ends immediately; no confirmation dialog needed |
| EMP-13 | As the platform, I want to detect when the same person has registered twice under different emails, so that a duplicate account does not split their chat history. | Heuristic duplicate detection at profile completion; flagged for manual review, not auto-merged (wrong merge risk outweighs duplicate cost) |
| EMP-14 | As the platform, I want a bulk deactivation affecting more than 20% of a roster to require Super Admin confirmation, so that an accidental mass-deactivation has a second check. | Threshold-based confirmation gate; affected count shown before proceeding; Super Admin notified by email |
| EMP-15 | As a person who is both a Company Admin and an employee at the same company, I want my own chat data to be invisible when I switch to admin view, so that my admin role and personal use are cleanly separated. | Single account, two role views; chat data strictly in employee view; role-switcher in UI header |

**EPIC-04 additions:**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| RISK-10 | As the platform, I want every escalation case to have a primary and a backup clinical staff assignee, so that unavailability of one person cannot leave a flagged employee unattended. | Backup assignee auto-notified if primary does not acknowledge within 15 minutes |
| RISK-11 | As Clinical Staff, I want repeated escalations from the same employee to be visually distinguished as a chronic-risk pattern, so that I apply appropriate long-term care context rather than treating them as isolated incidents. | Chronic-risk indicator after 3+ escalations in 30 days; case view shows full escalation history timeline |
| RISK-12 | As Clinical Staff, I want an explicit "escalate to emergency services" action on critical-tier cases, so that the platform supports the full range of real clinical responses -- not just "send to psychologist." | Action opens a checklist: confirm employee location info if known, log call to 119/emergency contact, document outcome; all steps logged in audit trail |
| RISK-13 | As Clinical Staff, I want a case I am actively working to be locked for other staff, so that two people cannot take conflicting actions on the same escalation simultaneously. | Optimistic lock for 10-minute windows; auto-release if inactive; second viewer sees read-only with "claimed by [name]" |
| RISK-14 | As the platform, I want to block deactivation of a clinical staff account that has open unresolved cases, so that cases never become ownerless when a staff member offboards. | Deactivation blocked with a list of open cases; cases must be manually reassigned before deactivation proceeds |
| RISK-15 | As the platform, I want a critical-risk flag outside staffed hours to immediately surface crisis resources in-chat AND trigger an on-call page, so that an employee in acute crisis at 3am is never shown a waiting screen. | Crisis resource card rendered in-chat within seconds of flag; on-call page runs in parallel; platform never says "help is on the way" unless a human has acknowledged the page |
| RISK-16 | As an employee whose escalation case has been closed, I want a non-alarming in-app message acknowledging the conversation is complete and inviting me back, so that the platform does not go silent after a difficult moment. | In-app message only (not email, to avoid lock-screen exposure); no clinical details in the message; supportive low-pressure tone |

**EPIC-05 additions:**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| ADM-8 | As a Super Admin, I want to reassign Company Admin access when the original admin has left the company, so that a client is never locked out of their own console due to HR turnover. | Super Admin can add a new Company Admin to any tenant; old admin account deactivated simultaneously |
| ADM-9 | As a Company Admin, I want to transfer my admin role to a colleague and remove myself, so that I can hand off without involving Tenang support. | Self-service transfer; new admin accepts via email; original admin role removed on acceptance |
| ADM-10 | As a Company Admin, I want to raise a support ticket on behalf of an employee about a product issue, so that employees do not need to contact Tenang directly for technical problems. | Ticket linked to company_id only; no employee identity or chat content included; Tenang support responds to Company Admin |

**EPIC-06 additions:**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| BILL-8 | As an employee in an active chat session when the company quota runs out, I want my current session to complete before access is blocked, so that a billing event does not terminate a conversation mid-thought. | Quota check runs at session start only; active sessions always allowed to finish |
| BILL-9 | As a Super Admin, I want to schedule a billing tier change with a future effective date, so that mid-contract pricing adjustments take effect at the correct time without disrupting current service. | Scheduled change visible in tenant billing record; current terms active until the scheduled date; Company Admin notified in advance |

**EPIC-07 additions:**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| TEN-6 | As a Super Admin, I want to place a legal hold on a specific tenant's data that prevents automatic deletion under TEN-3, so that Tenang can comply with a court order without destroying evidence. | Legal hold flag on tenant record; TEN-3 deletion skips records under hold; hold must be explicitly lifted by a Super Admin; all hold and lift actions logged in audit trail |

**EPIC-09 additions:**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| SUP-7 | As a Super Admin, I want to generate a data incident report for a specific tenant within 72 hours of a reported breach, so that we can meet UU PDP Art. 46 notification requirements. | Report covers: affected data types, estimated scope, timeline, mitigation steps; generated from audit logs; exportable as PDF |
| SUP-8 | As a Super Admin, I want MFA enforced for all Super Admin accounts and the ability to emergency-suspend a compromised account, so that a stolen credential cannot access all client data. | MFA mandatory for Super Admin login; emergency-suspend action logged; alert sent to all other Super Admins on use |
| SUP-9 | As a Super Admin, I want conflicting simultaneous edits to tenant configuration to surface a warning rather than silently overwriting, so that two admins working at the same time do not undo each other's changes. | Optimistic locking on tenant config records; conflict alert shows what changed and by whom; last writer must confirm override |
| SUP-10 | As a Super Admin, I want tenant deletion to require a second Super Admin's confirmation and a 48-hour soft-delete window, so that an accidental deletion can be recovered before data is permanently purged. | Two-person confirmation gate; soft-delete state preserves all data; hard delete runs after 48h unless reversed; email alert to all Super Admins |
| SUP-11 | As a Super Admin, I want to publish a platform-wide status message visible to all Company Admins and employees in-app, so that during an outage I can communicate clearly rather than leaving users guessing. | In-app banner for all tenants; Company Admin email notification; message includes an expected-resolution time field |
| SUP-12 | As Super Admin, I want Sales to complete a standardised handoff form before I provision a new tenant, so that I have all the information I need -- company name, size, billing model, Company Admin contact, contract terms, go-live date -- without a back-and-forth conversation. | Handoff form defined and owned by Sales; Super Admin cannot start provisioning without a completed form; form stored as an artefact against the tenant record |
| SUP-13 | As Super Admin, I want a provisioning SLA of one business day from completed handoff form to Company Admin invitation sent, and an activation watch that alerts me if the Company Admin has not logged in within 48 hours of invitation, so that provisioning delays are caught automatically rather than discovered at the first QBR. | Provisioning SLA tracked per tenant; missed SLA triggers an internal alert to Super Admin team; 48h activation watch fires an alert if Company Admin invitation is unaccepted |
| SUP-14 | As Super Admin, I want to be alerted when a client's utilization has been below a defined threshold for 30 consecutive days, so that I can flag at-risk clients to Sales before they reach the renewal conversation already disappointed. | Alert threshold configurable per tenant (default: <10% MAU for 30 days); alert routed to both Super Admin and the assigned Sales contact; alert includes a usage summary for context |
| SUP-15 | As Super Admin, I want an automated renewal reminder 90 days before a client's contract end date that routes to the assigned Sales contact along with the client's usage summary, so that the renewal conversation starts with data and enough lead time to act. | 90-day trigger per tenant contract end date; renewal reminder email to Sales + Super Admin; includes: active users, session count, utilization vs benchmark (EPIC-16), outstanding flags if any |

**EPIC-12 additions:**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| ENG-7 | As a Company Admin, I want to send a short anonymous pulse survey (3 questions max) to all employees, so that I can get direct structured wellbeing input separate from usage analytics. | Responses anonymous; minimum response threshold before results are revealed (same anonymization standard as EPIC-16); no free-text fields (prevents de-anonymization) |


### 8.8 User Journey & Flow Audit -- Broken and Missing Flows

This section walks every journey stage-by-stage and every documented user flow screen-by-screen to find where the experience breaks, where stages are missing, and where the handover between journeys is undefined. All items are classified and resolved in Section 8.8.

**Classification:**
- [BROKEN] -- the flow cannot complete as documented; something is structurally missing
- [MISSING STAGE] -- the journey works but skips a step that a real user would encounter
- [AMBIGUOUS] -- the flow exists but what actually happens is undefined; needs a decision before build

---

#### Journey A -- Employee: Invitation to Ongoing Use

| # | Location | Issue | Classification |
|---|---|---|---|
| A-1 | Stage 1 -> 2 | The invitation email is sent but there is no documented content for it. What does it say? Does it explain what Tenang is, what it is not (not therapy, not a crisis line), and what to expect? An employee receiving an unexplained link from HR is unlikely to click it. | [MISSING STAGE] |
| A-2 | Stage 4 -> 5 | After profile setup, the employee goes straight into chat with no orientation. There is no "here is what this AI can and cannot do" screen. Without this, the first session is likely to be misaligned -- employees may expect human therapy or emergency response. | [MISSING STAGE] |
| A-3 | Stage 5 | The AI's first message in a first-ever session is completely undocumented. Does it know this is a first-time user? Does it greet differently? The first message is the highest-stakes moment in the entire product -- leaving it undefined is a critical UX gap. | [AMBIGUOUS] |
| A-4 | Stage 5 -> 6 | What happens when a session ends? The SRS mentions "session summary" in the lifecycle but the employee's post-chat experience is never described. Is there a summary screen? A mood check-in prompt? A "see you next time" message? A content recommendation? The journey skips from "chat" to "ongoing use" with nothing in between. | [MISSING STAGE] |
| A-5 | Stage 6 | When an employee returns after a long absence (e.g., 3 months), what does the AI do? Does it acknowledge the gap ("it's been a while")? Does Mem0 still have context? Is there a "welcome back" state? Undefined. | [AMBIGUOUS] |
| A-6 | Stage 7 | When a risk flag fires during an active chat, what does the EMPLOYEE see? Does the chat UI change? Does a banner appear? Does the AI respond differently? Does the session continue normally? The employee's in-session experience during a risk event is completely undocumented -- this is a critical safety UX gap. | [BROKEN] |
| A-7 | Stage 7 | After a crisis resource card is shown, what happens to the active chat session? Does it end? Does the AI stop responding? Can the employee keep chatting? The flow has no defined state after the crisis card renders. | [BROKEN] |
| A-8 | Between A and C | After the crisis resource card (Journey A, Stage 7) and after Clinical Staff picks up the case (Journey C, Stage 3), the employee has no feedback loop. They do not know anyone has seen their session. RISK-16 covers the notification when the case is CLOSED, but there is nothing between "case opened" and "case closed" for the employee. They are left in silence during what may be the most acute moment. | [BROKEN] |
| A-9 | Not in journey | What if the employee tries to open a chat and their company's quota is 0? BILL-4 covers the message, but the journey has no "quota exhausted" path showing the employee's state, what options they have (wait? contact HR?), and what happens to their session history. | [MISSING STAGE] |
| A-10 | Not in journey | What if an employee already uses the B2C Tenang app with the same email and receives a B2B invitation? Do they have one account or two? Do their B2C history and B2B history merge? This conflict is entirely undefined. | [BROKEN] |

#### Journey B -- Company Admin: Contract to Renewal

| # | Location | Issue | Classification |
|---|---|---|---|
| B-1 | Stage 1 -> 2 | There is no "contract signing" stage. The journey jumps from "comparing vendors" (Stage 1) directly to "tenant provisioned" (Stage 2). The procurement step -- who signs what, what terms are agreed to, what information is collected for provisioning -- is entirely missing. This is also where the Sales-to-Super-Admin handoff happens, and there is no documented handoff artefact or SLA for provisioning time. | [BROKEN] |
| B-2 | Stage 2 -> 3 | After tenant provisioning, who trains the Company Admin on how to use the platform? There is no "admin onboarding/training" stage. If the admin goes from "received credentials" directly to "upload logo" with no guidance, the branding and rollout stages are likely to be done poorly. | [MISSING STAGE] |
| B-3 | Stage 4 | Rollout is described as "bulk-invites employees via CSV" but there is no internal communication guidance. What does the Company Admin tell employees BEFORE inviting them? What internal announcement, FAQ, or explainer should accompany the invite? Without this, employees receive an unexplained link (A-1 above) -- the two gaps compound each other. | [MISSING STAGE] |
| B-4 | Stage 5 | "Checks analytics dashboard periodically" -- what triggers this check? If the platform never proactively notifies the Company Admin that utilization is low or that risk trends have changed, the admin has to remember to log in. This is the passive monitoring model that kills EAP utilization. | [AMBIGUOUS] |
| B-5 | Between Stage 5 and 8 | There is no "low adoption response" stage. If after 60 days only 3% of employees have used the product, what does the Company Admin do? Can they reach out to Tenang for a campaign kit? Is there a recommended playbook? The most common EAP failure mode has no path in this journey. | [MISSING STAGE] |
| B-6 | Stage 7 -> 8 | There is no proactive renewal trigger. The journey shows the Company Admin "pulls a report" at renewal time, but what initiates the renewal conversation? Is there an automated reminder 90 days before contract end? Does Tenang's Sales team receive a signal? The renewal stage is disconnected from any platform-side trigger. | [AMBIGUOUS] |

#### Journey C -- Clinical/Internal Staff: Flag to Resolution

| # | Location | Issue | Classification |
|---|---|---|---|
| C-1 | Stage 1 | How does Clinical Staff know a new flag has appeared? The risk queue exists (RISK-1) but there is no documented notification mechanism. Email? SMS? Push notification? In-app only? Without this, clinical staff must keep the dashboard open and manually refresh to catch new cases -- this is not a viable model for a safety-critical feature. | [BROKEN] |
| C-2 | Stage 2 -> 3 | The journey shows only the path to escalation. What is the "dismiss" path? If Clinical Staff decides after triage that the flag is a false positive (RISK-4), what happens? The journey has no branch for "not escalating." | [MISSING STAGE] |
| C-3 | Stage 3 | "Sends case to a human psychologist" -- but who is this psychologist and what do they experience? The psychologist's side of this handoff is a complete black box. How are they notified? What system do they use to manage their caseload? What do they see? This is the most important handoff in the product and it has zero documentation. | [BROKEN] |
| C-4 | Stage 4 | "Human psychologist makes contact (out-of-band, phone/booking)" -- but what if the employee does not answer? What if the number is wrong? What if the employee refuses contact? The follow-up attempt has no documented retry flow, no time-out state, and no "employee unreachable" resolution path. | [MISSING STAGE] |
| C-5 | Stage 4 -> 5 | What if the psychologist's contact with the employee reveals the situation is MORE serious than initially triaged (e.g., needs hospitalization or 119)? The journey goes from "psychologist contacts employee" straight to "resolution." There is no "re-escalate" branch after follow-up. | [BROKEN] |
| C-6 | Stage 5 | Who has the authority to mark a case as "resolved"? The clinical staff member who triaged it? The psychologist who did the follow-up? A supervisor? Both? This is undefined and creates a compliance gap -- the audit trail requires a clear actor for the resolution action. | [AMBIGUOUS] |
| C-7 | Not in journey | Shift handover: if Clinical Staff A is working a case and their shift ends, how does Clinical Staff B get context? RISK-13 covers case locking during active work but says nothing about the narrative handover at shift change. | [MISSING STAGE] |
| C-8 | Not in journey | What if two employees from the same company are flagged in the same week? Journey C treats every case independently. There is no mechanism to notice a pattern across multiple employees of the same company -- which might indicate a systemic issue (toxic team, major org change). | [MISSING STAGE] |

#### Journey D -- Super Admin: New Client to Steady State

| # | Location | Issue | Classification |
|---|---|---|---|
| D-1 | Stage 1 | "Sales hands off a new client" -- but there is no standardized handoff document or checklist. What information does Sales pass to Super Admin? Company size, contract terms, billing model, special requirements, the Company Admin's contact details? Without a defined handoff artefact, every client onboarding is an ad-hoc conversation. | [BROKEN] |
| D-2 | Stage 1 -> 2 | There is no SLA or target time for provisioning after contract signing. Does the Company Admin expect to wait 1 hour? 1 day? 1 week? The absence of a commitment here is a gap that will create client dissatisfaction at the most sensitive moment of the relationship. | [MISSING STAGE] |
| D-3 | Stage 3 -> 4 | After the Company Admin invitation is sent, how does Super Admin know the handoff was successful? If the Company Admin never accepts the invitation, Super Admin needs to know. There is no "tenant activation check" between admin handoff and steady-state monitoring. | [BROKEN] |
| D-4 | Not in journey | There is no "client renewal" stage in Journey D. Journey B Stage 8 shows the Company Admin's renewal experience, but who owns the renewal from Tenang's side? When does Super Admin proactively flag a client as at-risk of churning (low utilization, slow adoption)? There is no revenue retention flow for the Super Admin. | [MISSING STAGE] |
| D-5 | Not in journey | Client goes live check: after provisioning and admin handoff, how does Super Admin verify the client is actually functioning (employees registering, first chats happening)? There is no "go-live verification" stage. | [MISSING STAGE] |

#### Cross-Journey Broken Handovers

| # | Between | Issue | Classification |
|---|---|---|---|
| X-1 | Journey A Stage 7 -> Journey C Stage 1 | The employee's crisis moment (A7) and the clinical staff detection (C1) are documented separately with no bridge. What is the state of the chat session the moment a risk flag fires? What does the employee see? What does clinical staff see? These two journeys run in parallel on the same event but are described as if they are sequential and separate. | [BROKEN] |
| X-2 | Journey B Stage 2 -> Journey A Stage 1 | The Company Admin sends invitations (B4) but the employee's invitation email content (A1) is undefined. The two journeys share this touchpoint -- the invitation email -- but neither documents what it actually says. | [MISSING STAGE] |
| X-3 | Journey D Stage 3 -> Journey B Stage 2 | Super Admin sends a Company Admin invitation (D3), and Journey B starts with the Company Admin already having access (B2). The onboarding experience for a Company Admin receiving their first platform credentials -- what they see, what they do first, what guidance they get -- is not documented in either journey. | [MISSING STAGE] |
| X-4 | Journey C Stage 3 -> psychologist | Journey C says "sends case to a human psychologist" but the psychologist has no journey at all. They are mentioned as the destination of an escalation but their workflow -- receiving the assignment, preparing for contact, making contact, logging the outcome -- has zero documentation. | [BROKEN] |

---

### 8.9 New Stories and Journey Updates from Flow Audit

#### Updated Journey A (with corrected and missing stages)

| Stage | Action | Touchpoint | Goal / Emotional State | Risk if This Fails |
|---|---|---|---|---|
| 1. Awareness | Receives a clear, human-written invitation email explaining what Tenang is and is not (not a crisis line, not therapy, fully confidential from employer) | Email (Mailjet template -- content defined in EMP-16) | Curious but skeptical; needs the privacy question answered before clicking | Generic corporate email = ignored; unclear privacy claim = ignored |
| 2. Registration | Clicks link, registers with email + password | /register | Wants speed and minimal friction | Long form = drop-off |
| 3. Verification | Enters OTP code | /verify-otp | Tolerates brief friction if fast | Delayed OTP = abandonment |
| 4. Profile setup | Completes short profile (age range, etc.) | /update-profile | Wants reassurance data isn't shared with employer | Too much personal info erodes trust |
| 4b. Orientation | Sees a one-screen explainer: what AI can do, what it cannot do, what stays private | Onboarding screen (EMP-16) | Wants to know what they are signing up for before the first message | No orientation = misaligned first session; false expectations about crisis response |
| 5. First chat | Starts conversation; AI opens with a first-time-user welcome that acknowledges this is a first session | /chat (SSE streaming, CHAT-13 first-message protocol) | Make-or-break -- "does it actually get me?" | Generic opener = trust lost before the conversation begins |
| 5b. Risk flag (conditional) | If AI detects high risk during session: crisis resource card appears in-chat; session continues unless employee chooses to end | In-chat crisis card + CHAT-13 state | Employee needs to feel help is available without the conversation being abruptly terminated | Abrupt session end at crisis moment = trust destroyed at the worst possible time |
| 6. Post-session | After session ends: sees a brief summary, optional mood check-in prompt, and a content/skill recommendation | Post-session screen (CHAT-14) | Wants to leave with something concrete, not just "conversation ended" | No post-session experience = session feels inconclusive; lower return rate |
| 7. Ongoing use | Returns for future sessions; AI recalls prior context and goals | /chat + Mem0 | Wants to feel recognized, not starting from zero | Memory failure = "it doesn't remember me, so it doesn't care" |
| 7b. Long absence | Returns after 3+ weeks; AI acknowledges the gap without pressure | /chat + CHAT-15 re-engagement state | Wants to feel welcomed back, not guilty for being away | Cold restart without acknowledgement = feels like starting from scratch |
| 8. Quota exhausted (conditional) | Tries to start a session when company quota is at 0 | Quota-exhausted screen (BILL-4) | Needs to understand why -- and know it is not a product failure | Silent failure = employee thinks the app is broken; never returns |

#### Updated Journey C (with corrected and missing stages)

| Stage | Action | Touchpoint | Goal / Emotional State | Risk if This Fails |
|---|---|---|---|---|
| 0. Alert | Clinical Staff receives a push/email notification when a new flag appears in their queue, so they do not need to monitor a dashboard passively | Notification (RISK-17) | Needs to be alerted fast enough to act within SLA | No notification = flags sit unreviewed; the triage queue is invisible |
| 1. Detection | Session auto-flagged; appears in clinical staff's queue | Risk queue dashboard | Flags must be accurate; alert fatigue is a real failure mode | Too many false positives = real flags ignored |
| 2a. Triage (escalate) | Reviews anonymized case detail; decides to escalate | Risk queue dashboard | Needs enough context to judge urgency | Too little context delays response; too much breaches privacy |
| 2b. Triage (dismiss) | Reviews case; marks as false positive with a reason code | Risk queue dashboard (RISK-4) | Needs to be able to dismiss without feeling like they are taking a risk | No dismiss path = staff escalate everything; clinical team overwhelmed |
| 3. Assignment | Assigns the case to a specific psychologist from Tenang's clinical team; psychologist receives a notification with the AI summary (RISK-8) | Case assignment flow (RISK-18) | Needs a named owner before the case leaves their queue | Unowned assignment = the hand-off is a black hole |
| 4. Follow-up | Psychologist contacts the employee (phone/booking); logs outcome in the case record | Case record -- follow-up log | Needs a structured log so the outcome is recorded regardless of what happens | Unstructured follow-up = no audit trail; no way to know if the employee was actually reached |
| 4b. Employee unreachable | Psychologist cannot reach the employee after defined retry attempts; case escalated to senior clinical staff or re-queued | RISK-19: unreachable protocol | Needs a defined end-state for "employee did not respond" so the case does not remain open indefinitely | No unreachable protocol = cases stay open forever or are silently abandoned |
| 4c. Re-escalate | Psychologist determines situation is more serious than triaged; routes to emergency services or senior review | RISK-12 emergency escalation | Needs an explicit up-escalation path after follow-up | No re-escalation path = psychologist has no formal mechanism to act on a more serious situation than expected |
| 5. Resolution | Case marked resolved; resolution authority documented (who closed it and why) | Audit log (RISK-20: resolution authority) | Needs a clear actor so the audit trail is legally defensible | Ambiguous resolution = compliance gap; no way to prove who decided the case was closed |
| 6. Outcome tracking | Case outcome monitored for 30 days (return to chat, mood trend, content engagement) | RISK-9 | Needs to know if the intervention actually worked | No outcome loop = clinical team cannot improve; no data for case studies |

#### Updated Journey D (with corrected and missing stages)

| Stage | Action | Touchpoint | Goal / Emotional State | Risk if This Fails |
|---|---|---|---|---|
| 0. Sales handoff | Sales provides Super Admin with a standard handoff form: company name, size, billing model, Company Admin contact, contract terms, go-live date commitment | Handoff artefact (SUP-12) | Wants complete information before starting provisioning | Incomplete handoff = wrong billing model configured; wrong admin invited |
| 1. Provisioning | Creates company record; sets billing model and quota; target time: same business day as handoff | Super Admin console; provisioning SLA (SUP-13) | Wants a repeatable checklist with a committed time | No SLA = company admin waits days with no communication |
| 2. Admin handoff | Invites client's first Company Admin; starts a 48h activation watch | Email invite + activation monitoring (SUP-13) | Wants to know the handoff actually reached the right person | Admin invite bounces or is ignored; nobody notices for a week |
| 3. Go-live verification | Confirms: Company Admin has logged in, configured branding, sent at least one batch of invitations, first employee has registered | Go-live checklist (SUP-13) | Wants to close the provisioning loop before moving to steady state | Client technically provisioned but operationally dead; discovered only at first QBR |
| 4. Steady state monitoring | Reviews cross-tenant health (uptime, aggregate usage, billing) | Super Admin dashboard | Business visibility without any employee-level data | -- |
| 5. Client health alerting | Platform proactively alerts Super Admin when a client's utilization drops below a threshold or has not had any active users in 30 days | Client health alert (SUP-14) | Needs to know which clients are at churn risk before the renewal conversation | No proactive signal = churn discovered at renewal, too late to intervene |
| 6. Renewal signal | 90 days before contract end, Super Admin receives a renewal reminder with the client's usage summary; routes to Sales | Renewal trigger (SUP-15) | Wants to give Sales enough lead time to run a renewal conversation before the contract lapses | No renewal trigger = contract lapses unnoticed; client churns without a conversation |

---

## 9. Epic Overview

| Epic ID | Epic Name | Priority | Phase | Summary |
|---|---|---|---|---|
| EPIC-01 | Company Onboarding | P0 | 1 | Provision a new tenant company and get its admin access-ready |
| EPIC-02 | Employee Onboarding & Authentication | P0 | 1 | Invited employees register, verify, and join their employer's tenant |
| EPIC-03 | AI Psychologist Chat | P0 | 1 | Core AI conversation experience with persistent memory |
| EPIC-04 | Risk & Safety Escalation | P0 | 1 | Detect high-risk sessions and route them to human follow-up |
| EPIC-05 | Company Admin Console | P0 | 1 | HR-facing dashboard for roster, usage, and risk visibility |
| EPIC-06 | Subscription & Billing | P1 | 1 (quota) -> 2 (PAYG + invoicing) | Quota and consumption-based billing per tenant |
| EPIC-07 | Multi-Tenant Data Isolation | P0 | 1 | Guarantee no cross-tenant data leakage as tenant count grows |
| EPIC-08 | Employee Assessment (N2CIAS) | P2 | 2 | Optional structured assessment module |
| EPIC-09 | Platform Administration (Super Admin) | P0 | 1 | Tenant provisioning, cross-tenant visibility, and role governance |
| EPIC-10 | Company Branding & Preferences | P1 | 1 | Per-tenant logo, brand color, and configurable preferences |
| EPIC-11 | Self-Guided Content & Programs | P1 | 2 | Structured asynchronous exercises and courses between chat sessions |
| EPIC-12 | Notifications & Engagement | P1 | 2 | Proactive nudges that bring employees back between sessions |
| EPIC-13 | HRIS & SSO Integration | P1 | 2 | Single Sign-On and HRIS sync for automatic roster management |
| EPIC-14 | Mood Check-in & Daily Pulse | P1 | 2 | Daily optional mood prompt that builds habit loop and feeds AI context |
| EPIC-15 | Goal-Setting & Progress Tracking | P1 | 2 | AI co-sets session goals using Mem0; visual milestone tracking |
| EPIC-16 | Workforce Analytics (Benchmark + Departmental) | P1 | 2 | Utilization benchmarks vs industry peers and department-level aggregate view |
| EPIC-17 | Freemium & Trial Tier | P2 | 2 | Limited free tier to remove budget-commitment barrier for smaller clients |
| EPIC-18 | Bookmarks & Saved Moments | P1 | 2 | Personal library of saved chat insights, content steps, and techniques |
| EPIC-19 | Skills & Techniques Library | P1 | 2 | On-demand searchable catalogue of coping techniques with interactive practice |

---

## 10. Product Scope -- V1 (B2B MVP)

### In scope
- Company tenant provisioning by a Super Admin
- HR Admin invites employees via email (time-limited token)
- Employee self-registration, OTP verification, profile setup
- AI psychologist chat with persistent memory
- Per-session and cross-session risk detection, surfaced to a human-reviewable queue
- Company-scoped analytics dashboard
- Quota-based billing per company
- Company Admin-configurable branding (logo, brand color) and basic preferences
- Permanent crisis resource quick-access button (Into The Light Indonesia hotline)
- Four-tier role separation: Super Admin / Company Admin / Clinical-Internal Staff / Employee

### Explicitly out of scope for V1
- Public self-checkout (V1 is sales-assisted; self-serve signup is V2)
- Native mobile apps (web-responsive only)
- Video/voice counseling sessions
- Full white-labeling -- custom domains or separate branded web apps per client (the mayapada-web pattern). Logo/color branding within the shared product (EPIC-10) is in scope; a client-specific domain is not.
- Self-guided content library (EPIC-11) -- Phase 2
- EPIC-12 through EPIC-19 -- Phase 2
- Multi-language support beyond Bahasa Indonesia and English

---

## 11. Functional Requirements -- Epics & User Stories

### EPIC-01 -- Company Onboarding

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| ONB-1 | As a Super Admin, I want to create a new company tenant with a name, contact, and billing model, so that we can onboard a client without a one-off engineering effort. | Company record created; default quota configurable; isolated from all other tenants' data |
| ONB-2 | As a Company Admin, I want to receive credentials to access my company's admin console, so that I can manage our account without needing platform engineering. | Admin invited via email, scoped to one company_id only |
| ONB-3 | As a Company Admin, I want to bulk-invite employees via CSV or email list, so that I can roll out the benefit to my whole workforce in one action. | JWT invitation pattern; 24h token expiry; Mailjet templated email |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| ONB-4 | As a Super Admin, I want tenant creation to fail clearly if the company name/domain already exists, so that we don't accidentally create duplicate billing records. | Uniqueness check; clear error, not a silent duplicate |
| ONB-5 | As a Company Admin, I want to request a fresh invite if my original admin link expires, so that a slow start doesn't permanently lock me out. | Re-issue flow with new 24h JWT token |
| ONB-6 | As a Company Admin, I want a bulk-invite CSV with bad rows to fail only those rows, so that one mistake doesn't block the entire rollout. | Per-row validation; downloadable error report; valid rows still process |
| ONB-7 | As a Super Admin, I want to suspend or offboard a company tenant when a contract ends, so that former clients' employees lose access immediately and their data enters the retention process. | Access revoked same-day; data lifecycle starts per TEN-3 policy |
| ONB-8 | As a Company Admin, I want to edit my company's basic contact details after onboarding, so that routine updates don't require contacting Super Admin. | Self-service edit for non-billing, non-quota fields |

### EPIC-02 -- Employee Onboarding & Authentication

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| EMP-1 | As an invited employee, I want to register with email + password and verify via OTP, so that my account is secure and belongs to me alone. | /register, /verify-otp flow |
| EMP-2 | As an employee, I want to complete a short profile before my first chat, so that the AI can tailor itself without me re-explaining myself every session. | /update-profile flow |
| EMP-3 | As an employee, I want my account automatically scoped to my employer's tenant, so that I never have to manually configure which company I belong to. | Tenant association set at invitation time, not user-editable |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| EMP-4 | As an invited employee, I want to request a new OTP if mine expires or never arrives, so that a delivery delay doesn't lock me out. | Resend with rate limiting (max 3 per 15 minutes) |
| EMP-5 | As an invited employee, I want a clear error and a path to ask HR for a new link if my invitation has expired. | Expired-token state with "request new invite" action routed to Company Admin |
| EMP-6 | As an employee, I want to reset my password if I forget it, so that I'm not permanently locked out of a tool I might need urgently. | Standard email-based reset flow, rate-limited against abuse |
| EMP-7 | As the platform, I want to reject registration attempts using an email that was never invited, so that the product can't be used outside a paying client's employee base. | Registration checks against invitation record before account creation |
| EMP-8 | As a Company Admin, I want to deactivate an employee's account when they leave the company, so that former employees lose access immediately. | Immediate session revocation on deactivation |
| EMP-9 | As an employee, I want my session to expire after inactivity, so that a shared or unattended device doesn't leave my conversations exposed. | Configurable idle timeout; re-authentication required after |

### EPIC-03 -- AI Psychologist Chat (Core Experience)

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| CHAT-1 | As an employee, I want to start a conversation and get responses in real time, so that I get support the moment I need it. | SSE streaming; session lifecycle (start -> message -> end -> summary) |
| CHAT-2 | As an employee, I want the AI to remember context from my previous sessions, so that I don't have to repeat my history every time. | Mem0-backed long-term memory, already implemented |
| CHAT-3 | As an employee, I want to see my past session history, so that I can reflect on my progress over time. | Session summary retrieval, already implemented |
| CHAT-4 | As the platform, I want every session checked for risk level, so that at-risk employees are never missed even if they never explicitly ask for help. | Implemented at AI-engine layer; needs explicit documented thresholds |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| CHAT-5 | As an employee, I want a clear human-toned fallback message if the AI is temporarily unavailable, so that an outage isn't mistaken for the product abandoning me mid-conversation. | Graceful degradation message, distinct from a network error |
| CHAT-6 | As an employee, I want to permanently delete my chat history and memory, so that I keep control over my own data. | Deletion removes Mem0 memory and session records, not just hides them in the UI |
| CHAT-7 | As the platform, I want to detect and contain prompt injection and jailbreak attempts, so that the AI's guardrails can't be talked around. | Input/output filtering layer; flagged attempts logged for review |
| CHAT-8 | As an employee, I want an in-progress message to survive a brief network drop and resume, so that a flaky connection doesn't cost me a conversation I worked up the nerve to start. | Client-side retry/resume on reconnect within a short grace window |
| CHAT-9 | As the platform, I want a documented ceiling on session length, so that cost and abuse risk are bounded without abruptly cutting off a user. | Soft warning before the limit; graceful session-end message at the limit |

**Integration hooks**

| ID | Connection | Detail |
|---|---|---|
| CHAT-10 | EPIC-14 mood context | AI opens a session by referencing the employee's latest mood check-in score if one exists; surfaced in AI system prompt, not shown verbatim to the employee |
| CHAT-11 | EPIC-15 goal recall | AI recalls goals co-set in a previous session and checks in on them at the right moment; stored in Mem0 |
| CHAT-12 | EPIC-11/EPIC-19 recommendation | AI surfaces a relevant self-guided program or skill card recommendation at the natural end of a session |

### EPIC-04 -- Risk & Safety Escalation

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| RISK-1 | As Clinical/Internal Staff, I want a real-time queue of red-flagged sessions, anonymized by default, so that I can triage urgent cases without unnecessary identity exposure. | Builds on existing highRiskUsers dashboard data |
| RISK-2 | As Clinical Staff, I want to escalate a flagged case to a human psychologist on Tenang's own clinical team, so that high-risk employees get timely human intervention. | send-to-psychologist route exists on dev -- needs formal SLA |
| RISK-3 | As a Company Admin, I want to see aggregate red-flag counts for my company -- never individual identities, unless an employee opts in -- so that I can gauge workforce wellbeing without violating employee trust. | Hard privacy boundary; must be specified before build |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| RISK-4 | As Clinical Staff, I want to mark a flagged session as a false positive with a reason, so that the detection model can be tuned over time. | Dismiss action with required reason code; feeds back into detection tuning |
| RISK-5 | As the platform, I want an escalated case that goes unacknowledged past the SLA window to automatically re-escalate to a supervisor, so that one missed notification can't let a real crisis fall through. | Automated SLA timer with supervisor escalation path |
| RISK-6 | As Clinical Staff, I want sessions flagged as imminent/critical risk to route through a faster separate path, so the most urgent cases never wait behind lower-urgency ones. | Distinct priority queue with tighter SLA for critical-tier flags |
| RISK-7 | As a Company Admin, I want visibility into whether clinical staff coverage has any gaps, so that I don't promise my employees "always available" support the platform can't yet back up 24/7. | Coverage status surfaced honestly in onboarding materials and admin console |

**Integration hooks**

| Connection | Detail |
|---|---|
| RISK -> EPIC-11 | Post-escalation content recommendation via CONT-5; content engagement tracked in RISK-9 outcome loop |
| RISK -> EPIC-14 | Mood trend post-escalation surfaced in outcome view for closed cases |
| RISK -> EPIC-16 | RISK-3 anonymized red-flag counts feed into EPIC-16 departmental analytics |

### EPIC-05 -- Company Admin Console

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| ADM-1 | As a Company Admin, I want usage analytics scoped only to my company, so that I can prove the benefit's value to my leadership. | /analytics-dashboard pattern, filtered by company_id |
| ADM-2 | As a Company Admin, I want to manage my employee roster, so that access stays current as people join and leave. | Existing team-invitation pattern |
| ADM-3 | As a Company Admin, I want to view my current quota usage and billing status, so that I'm never surprised by an invoice. | useBilling / warning-level pattern (none/warning/critical/exceeded) |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| ADM-4 | As a Company Admin, I want a clear empty state when my company has no usage data yet, so that a freshly onboarded account doesn't look broken. | Onboarding-aware empty state, not a blank chart |
| ADM-5 | As a Company Admin, I want to export a usage report (CSV or PDF), so that I can share it with my leadership without screenshotting a dashboard. | Export action covers the same data shown on-screen |
| ADM-6 | As a Company Admin, I want to invite a second Company Admin within my own company, so the admin function isn't a single point of failure. | New admin scoped to the same company_id; no cross-tenant reach |
| ADM-7 | As the platform, I want any Company Admin request for data outside their own company_id to be rejected and logged. | Server-side tenant check on every request, not just UI-level filtering |

**Integration hooks**

| Connection | Detail |
|---|---|
| ADM -> EPIC-16 | EPIC-16 adds utilization benchmark and department-level panels as additive views in the existing admin dashboard |
| ADM -> EPIC-14 | Aggregate anonymized mood trend shown as a secondary data layer (minimum group size enforced) |
| ADM -> EPIC-12 | ENG-3 company-wide announcement surfaced as a new action inside the existing admin console UI |
| ADM -> EPIC-09 | ADM-11 alert threshold is configured by Super Admin via SUP-6 feature flag per tenant |

### EPIC-06 -- Subscription & Billing

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| BILL-1 | As a Company Admin, I want to see remaining session quota and overage charges, so that I can manage budget proactively. | getBillingInfo, getWarningLevel |
| BILL-2 | As a Super Admin, I want to configure a company's quota and pricing tier, so that each contract's commercial terms are reflected accurately. | CompanyBillingConfigCard pattern from dev |
| BILL-3 | As a Super Admin, I want invoicing and payment collection to run automatically each billing cycle, so that revenue collection doesn't depend on manual follow-up. | New requirement -- current implementation handles in-session purchases (Xendit), not recurring B2B invoicing |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| BILL-4 | As an employee, I want a clear message -- not a broken chat -- if my company's quota is exhausted, so I understand why I can't start a session. | Explicit quota-exhausted state, distinct from a technical error |
| BILL-5 | As a Company Admin, I want to be notified automatically if a payment fails, with a grace period before service is suspended. | Failed-payment notification + configurable grace period before BILL-6 triggers |
| BILL-6 | As a Super Admin, I want to suspend chat access for a company overdue on payment, while preserving their data. | Suspension blocks new sessions; data retained per policy until resolved or offboarded |
| BILL-7 | As a Company Admin, I want my quota to adjust when I add a large batch of new employees mid-cycle. | Quota recalculation triggered by roster changes, or clear manual-adjustment path |

**Integration hooks**

| Connection | Detail |
|---|---|
| BILL -> EPIC-17 | Freemium tier modeled as a zero-cost billing state within the existing engine; tier upgrade activates quota without data migration |
| BILL -> EPIC-09 | Super Admin controls tier upgrades and scheduling via SUP-6 feature flags and BILL-9 |

### EPIC-07 -- Multi-Tenant Data Isolation

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| TEN-1 | As the platform, I want every data record to carry a company_id and be unreachable cross-tenant. | Currently isolation = separate infrastructure per client (the Mayapada pattern). Must move to row-level tenancy. |
| TEN-2 | As the platform, I want a clear four-tier role hierarchy: Super Admin -> Company Admin -> Clinical/Internal Staff -> Employee. | USER_ROLE, INTERNAL_ROLE, ADMIN_ROLE, SUPER_ADMIN_ROLE exist as constants but none are tenant-scoped today |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| TEN-3 | As the platform, I want a defined data retention and deletion process for when a tenant offboards. | Retention period + deletion process specified and enforced, aligned with UU PDP |
| TEN-4 | As Platform Internal Staff, I want any cross-tenant support access to be explicitly logged and time-boxed. | Time-limited, logged impersonation/support-access mode only |
| TEN-5 | As the platform, I want automated tests that attempt cross-tenant data access and assert they fail. | CI-integrated isolation tests, run on every relevant deploy |

### EPIC-08 -- Employee Assessment (N2CIAS) -- Phase 2

| ID | User Story | Acceptance Criteria |
|---|---|---|
| ASS-1 | As a Company Admin, I want to optionally enable the N2CIAS structured assessment module, so that I can offer a more clinical screening tool alongside open-ended chat. | Opt-in toggle, off by default for new tenants |
| ASS-2 | As an employee, I want assessment results to follow the same anonymization rules as chat risk data. | Same RISK-3 privacy boundary applied to assessment data |

### EPIC-09 -- Platform Administration (Super Admin Console)

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| SUP-1 | As a Super Admin, I want to provision and configure new enterprise tenants, so that onboarding the next client doesn't require a one-off engineering effort. | Extends EPIC-01; Super Admin is the actor who creates a company record |
| SUP-2 | As a Super Admin, I want a cross-tenant view of platform health and business metrics, so that I can manage the business across all clients without touching any tenant's identifiable employee data. | Business metrics only; never employee identities or transcripts |
| SUP-3 | As a Super Admin, I want to manage role assignments with every privilege change logged, so that platform access stays auditable. | ADMIN_ROLE / INTERNAL_ROLE / SUPER_ADMIN_ROLE tenant-scoped and audit-logged |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| SUP-4 | As a Super Admin, I want a platform-wide audit log of privilege changes, tenant creations, and support-access events. | Searchable, append-only audit log |
| SUP-5 | As a Super Admin, I want to immediately revoke all active sessions for a tenant, so access can be cut off in minutes, not at the next natural login expiry. | One action invalidates all active sessions for a given company_id |
| SUP-6 | As a Super Admin, I want to enable or disable optional modules per tenant via feature flags, so not every client needs the full feature set. | Per-tenant feature-flag configuration |

### EPIC-10 -- Company Branding & Preferences

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| BRAND-1 | As a Company Admin, I want to upload my company's logo, so that my employees see a branded experience from my organization. | Logo appears in chat UI, admin console header, and invitation emails for that tenant |
| BRAND-2 | As a Company Admin, I want to set my company's primary brand color, so that the experience feels visually consistent with our identity. | Brand color applied to key UI accents across employee and admin experience |
| BRAND-3 | As a Company Admin, I want to configure other preferences (welcome message, default language, notification settings), so that I can tailor the experience without needing engineering support. | Preferences stored per company_id, editable from admin console at any time |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| BRAND-4 | As the platform, I want uploaded logos and chosen colors validated (file size/type, minimum contrast for accessibility) before they're applied. | Upload rejected with a clear reason if it fails validation; contrast checked against WCAG AA minimums |
| BRAND-5 | As an employee, I want my company's default Tenang branding to display correctly even if the Company Admin hasn't configured custom branding yet. | Sensible default branding applies automatically until a Company Admin overrides it |

### EPIC-11 -- Self-Guided Content & Programs

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| CONT-1 | As an employee, I want to browse a library of short, self-guided programs (stress, sleep, burnout), so that I have a reason to open the app even when I'm not in active crisis. | Initial library of curated categories; not a fully built-out catalog for V1 |
| CONT-2 | As an employee, I want to complete guided exercises in a chat-like, interactive format, so that the experience feels consistent with the conversational AI chat I already use. | Reuses existing chat UI pattern |
| CONT-3 | As the platform, I want to track which programs an employee has engaged with, respecting the same privacy boundary as chat data. | Engagement data stored per-employee; never exposed to Company Admins individually |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| CONT-4 | As a Company Admin, I want aggregate anonymized engagement data on which content categories my employees use most. | Category-level aggregation only; same anonymization boundary as RISK-3 |
| CONT-5 | As Clinical Staff, I want to recommend specific programs to an employee following a flagged session. | Recommendation logged as part of the escalation record (ties into RISK-2 follow-up) |

**Integration hooks**

| Connection | Detail |
|---|---|
| CONT -> EPIC-12 | Content progression triggers notification (ENG-2); EPIC-12 owns delivery logic |
| CONT -> EPIC-03 | CHAT-12: AI can recommend a relevant program at end of session |
| CONT -> EPIC-15 | Program completion is a milestone event in EPIC-15's progress tracker |

### EPIC-12 -- Notifications & Engagement

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| ENG-1 | As an employee, I want to receive a gentle opt-in reminder when I haven't opened the app in a while. | Configurable frequency (weekly/biweekly); employee can adjust or disable at any time |
| ENG-2 | As an employee, I want to receive a notification when a self-guided program I started has a new step ready. | Triggered by content progression state (EPIC-11) |
| ENG-3 | As a Company Admin, I want to send a company-wide announcement to all active employees, so that I can promote awareness at key moments. | Announcement scoped to own company_id; no access to employee chat content |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| ENG-4 | As an employee, I want all notification preferences collected and honoured in one place. | Single notification preference centre; unsubscribe from any channel respected globally |
| ENG-5 | As the platform, I want notification frequency capped per employee regardless of how many triggers fire. | Global rate limit per user per day/week |
| ENG-6 | As the platform, I want notification content to never reference a user's specific chat content or risk status. | All notification copy is generic/category-level, never personalized to session content |

**Integration hooks**

| Connection | Detail |
|---|---|
| ENG -> EPIC-14 | When employee has not completed a mood check-in in 3+ days, EPIC-12 can send a gentle prompt |
| ENG -> EPIC-11 | Content progression state (EPIC-11) is the trigger source; EPIC-12 owns delivery |
| ENG -> EPIC-02 | Employee sets initial notification preferences during profile setup (EMP-2); EPIC-12 pre-populated from that selection |

### EPIC-13 -- HRIS & SSO Integration

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| INT-1 | As a Company Admin, I want to connect Tenang to our company's HRIS so that new hires are automatically invited and departing employees are automatically deactivated. | OAuth-based HRIS connector; sync on configurable schedule; failures surface as alerts in admin console |
| INT-2 | As an employee, I want to log into Tenang using my existing company SSO credentials, so that I don't have to manage a separate password. | SAML 2.0 or OIDC SSO; fallback to email/password for companies without SSO configured |
| INT-3 | As a Company Admin, I want SSO to be an optional separately-configured setting, not a requirement, so that smaller clients or those without an IdP can still onboard without IT involvement. | SSO is opt-in per tenant; email/password auth remains functional |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| INT-4 | As a Company Admin, I want HRIS sync conflicts to surface in a review queue rather than auto-resolve silently. | Conflict queue with Company Admin sign-off required before conflicted records are applied |
| INT-5 | As the platform, I want HRIS sync to be additive and deactivation-only -- never deleting employee data. | Sync deactivates access; data retained per TEN-3 policy |
| INT-6 | As a Company Admin, I want to disconnect an HRIS integration at any time and revert to manual roster management without losing data. | Integration can be disabled; manual management resumes; existing accounts unaffected |

**Integration hooks**

| Connection | Detail |
|---|---|
| INT -> EPIC-01 | HRIS sync (INT-1) is an alternative to the manual CSV bulk-invite (ONB-3); same company_id association |
| INT -> EPIC-02 | SSO (INT-2) replaces email+password registration (EMP-1) for companies that enable it |
| INT -> EPIC-06 | HRIS roster changes trigger quota recalculation logic in BILL-7 automatically |

### EPIC-14 -- Mood Check-in & Daily Pulse

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| MOOD-1 | As an employee, I want to see a quick mood check-in prompt when I open the app, so that I build a habit of reflection without needing to start a full chat session. | Single optional prompt (emoji scale or 1-5); takes <5 seconds; skippable at any time |
| MOOD-2 | As an employee, I want to see my mood trend over the past 4 weeks, so that I can notice patterns I might not see day-to-day. | Visual trend chart in personal dashboard; only visible to the employee, never to Company Admin |
| MOOD-3 | As the AI, I want to read the employee's latest mood score at the start of a session, so that I can open with something relevant to where they actually are today. | Mood record available in session context (CHAT-10 integration); AI uses it as soft context |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| MOOD-4 | As an employee, I want to skip the mood check-in without penalty, so that a hard day where I don't want to answer doesn't make the app feel nagging or surveillance-like. | Skip always available; no streak-broken message; no notification triggered specifically because a check-in was skipped |
| MOOD-5 | As the platform, I want a sustained low mood trend to softly surface the option to start a chat or access crisis resources, so that a struggling employee gets a low-friction nudge toward support without being flagged to their employer. | Triggered in-app message only to the employee; not surfaced in HR analytics; not a risk flag unless chat content also triggers EPIC-04 thresholds |

### EPIC-15 -- Goal-Setting & Progress Tracking

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| GOAL-1 | As an employee, I want the AI to help me identify 1-2 small concrete goals at a natural moment in the conversation, so that I leave each session with something specific to try. | Goal-setting is AI-initiated at the right conversational moment (not forced at session start); goals stored as structured records in Mem0 |
| GOAL-2 | As an employee, I want the AI to check in on previous goals at the right moment in a later session, so that my progress feels acknowledged and the conversation builds on itself. | Goal recall from Mem0; AI decides when to surface them (not every session); check-in is conversational, not a form |
| GOAL-3 | As an employee, I want to see a timeline of milestones (sessions completed, goals achieved, programs finished), so that I can see how far I've come over weeks or months. | Visual milestone view in personal dashboard; pulls from EPIC-03 (session history), EPIC-15 (goal records), and EPIC-11 (content completions) |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| GOAL-4 | As an employee, I want to edit or remove a goal I set previously, so that life changes don't leave me feeling judged for not completing something that no longer makes sense. | Goal edit/delete available in personal dashboard; deletion removes from Mem0 too |
| GOAL-5 | As the platform, I want goal content to follow the same privacy boundary as chat content -- never visible to Company Admin or Super Admin. | Goals stored per-employee; same access controls as session data; excluded from all HR-facing analytics |

### EPIC-16 -- Workforce Analytics (Benchmark + Departmental)

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| WFA-1 | As a Company Admin, I want to see how my company's utilization compares to an anonymized industry benchmark, so that I can frame performance for leadership in a way that's meaningful beyond our own numbers. | Benchmark shown as a range (e.g., "companies like yours: 18-30% MAU"); sourced from anonymized cross-tenant aggregate |
| WFA-2 | As a Company Admin, I want to see aggregate utilization and wellbeing signals broken down by department, so that I can identify which teams might benefit from targeted outreach. | Department view requires minimum group size (>=5 employees) before data is shown, to prevent de-anonymization |
| WFA-3 | As a Company Admin, I want the departmental view to include both usage data and anonymized mood trend, so that I can distinguish between "this team isn't using the app" and "this team is using it and still trending low." | Mood data (EPIC-14) aggregated at department level; same minimum group size rule |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| WFA-4 | As the platform, I want benchmark data updated on a lag (e.g., 30 days), not real-time, so that individual tenant data can't be inferred by watching the benchmark shift. | Benchmark refreshed on scheduled batch, not live |
| WFA-5 | As a Company Admin, I want to download the departmental analytics view as a PDF/CSV, so that I can include it in an internal wellness report. | Export action, same pattern as ADM-5 |

### EPIC-17 -- Freemium & Trial Tier

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| FREE-1 | As a prospective Company Admin, I want to sign up for a free trial with a limited number of sessions and no escalation SLA, so that I can experience the product before committing a budget. | Trial provisioned as a zero-cost billing tier; session cap configurable by Super Admin via SUP-6 |
| FREE-2 | As a Company Admin on a trial, I want a clear non-pressuring indicator of how many trial sessions remain. | Session counter visible in admin console; no dark-pattern urgency messaging |
| FREE-3 | As a Super Admin, I want to convert a trial tenant to a paid tier in one action, preserving all existing employee accounts, data, and chat history, so that conversion is frictionless. | Tenant's company_id, employee records, and session history persist across tier change; only billing state changes |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| FREE-4 | As the platform, I want trial accounts to have the same data isolation and privacy guarantees as paid tenants. | Trial tenants subject to identical TEN-1/TEN-2 isolation rules; no data sharing across trial accounts |
| FREE-5 | As the platform, I want trial accounts to expire after a configurable period with advance warning, so that dormant trials don't accumulate as operational overhead. | Expiry warning 7 days before; on expiry, access suspended (data retained per TEN-3); Super Admin can reactivate |

### EPIC-18 -- Bookmarks & Saved Moments

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| BKM-1 | As an employee, I want to bookmark any message in a chat session -- something the AI said, a reframe I found helpful -- so that I can find it again later without scrolling through session history. | Bookmark icon on each AI message bubble; saved to a personal "Saved" section accessible from the home screen |
| BKM-2 | As an employee, I want to bookmark an exercise or step from a self-guided program, so that I can revisit the technique without replaying the whole program. | Bookmark action on individual content steps in EPIC-11; saved alongside chat bookmarks |
| BKM-3 | As an employee, I want to add a short personal note to a bookmark, so that I can remember why it mattered when I re-read it later. | Optional free-text note field on each bookmark; editable after saving |
| BKM-4 | As an employee, I want to organise my bookmarks by tag or category, so that I can quickly find the type of thing I'm looking for. | Free-form tags on each bookmark; filterable tag list in the saved library |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| BKM-5 | As an employee, I want my bookmarks to be completely private -- not visible to my employer, not visible to clinical staff, not referenced in aggregate analytics. | Bookmarks excluded from all analytics pipelines; no export path to HR or clinical views |
| BKM-6 | As an employee, I want my bookmarks to persist even if I delete the chat session they came from, so that saving something means it's actually saved. | Bookmark stores text content at save-time (not a pointer to the session); survives session or memory deletion (CHAT-6) |
| BKM-7 | As an employee, I want to delete bookmarks individually or clear them all. | Delete single / delete all available; permanent deletion, not archiving |

**Integration hooks**

| Connection | Detail |
|---|---|
| BKM -> EPIC-03 | Bookmark action added to AI message bubbles in existing chat UI |
| BKM -> EPIC-11 | Bookmark action on individual content steps; same personal library as chat bookmarks |
| BKM -> EPIC-15 | A bookmarked technique can be promoted to a practice goal in EPIC-15 with one tap |
| BKM -> EPIC-19 | Techniques from EPIC-19 skills library can be bookmarked directly from the skill card |

### EPIC-19 -- Skills & Techniques Library

**Core flow**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| SKL-1 | As an employee, I want to browse a searchable library of concrete coping techniques (breathing, grounding, CBT reframes, sleep hygiene), so that I have a go-to resource in the moment I need it, separate from starting a full chat session. | Searchable by keyword and category; each technique has a title, "when to use this" description, and an interactive guided practice (not just a static article) |
| SKL-2 | As an employee, I want the AI to teach me a specific skill during a chat session and then make it immediately findable in the skills library afterwards, so that something I learned in conversation becomes a permanent personal resource. | When AI guides a technique in chat, the corresponding skill card is "unlocked" and pinned in the employee's skills library; the card is interactive, not just a transcript of the chat |
| SKL-3 | As an employee, I want to practise a technique directly from the skill card (animated breathing timer, guided journaling prompt, step-by-step grounding exercise), so that the library is a tool I use, not a document I read. | Each skill card has an interactive practice mode with a completion signal; practice logged as an engagement event (feeds EPIC-15 progress) |
| SKL-4 | As the AI, I want to recommend a specific skill card at the right moment in a session, so that the conversation connects naturally to the tools the employee already knows. | AI can surface a skill card as an in-chat card component; employee can tap to open the interactive practice without leaving the session |

**Edge cases & safeguards**

| ID | User Story | Acceptance Criteria |
|---|---|---|
| SKL-5 | As a Company Admin, I want aggregate anonymized data on which skill categories my employees use most. | Category-level aggregation only; minimum group size rule same as EPIC-16 |
| SKL-6 | As Clinical Staff, I want to assign a specific skill to an employee as part of a post-escalation follow-up plan. | Assign action available in the escalation record (extends RISK-2 and CONT-5); employee sees the assigned skill pinned at the top of their library |
| SKL-7 | As the platform, I want skill content to be reviewed and approved by a qualified clinical resource before it is published, so that no technique that could be harmful goes live without clinical sign-off. | Content review workflow: draft -> clinical review -> approved -> live; no self-publish path for skill content |

**Integration hooks**

| Connection | Detail |
|---|---|
| SKL -> EPIC-03 | CHAT-12 extended: AI can recommend a skill card at the end of a session; SKL-4 allows inline practice within chat |
| SKL -> EPIC-11 | Shared content infrastructure; a skill can be part of a program module |
| SKL -> EPIC-15 | Completing an interactive skill practice is a milestone event in the EPIC-15 progress tracker |
| SKL -> EPIC-18 | Any skill card can be bookmarked from the library |
| SKL -> EPIC-04 | Clinical staff can assign skills post-escalation (SKL-6); engagement tracked in RISK-9 outcome loop |
| SKL -> EPIC-14 | When MOOD-5 triggers a low-mood nudge, one prompt can be a direct link to a relevant skill card |

---

## 12. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Privacy** | Individual chat transcripts, bookmarks, goals, and mood data are never visible to Company Admins or Super Admins. Only aggregate, anonymized data crosses each boundary. |
| **Data residency** | All tenant data hosted in-region (GKE, asia-southeast2) |
| **Availability** | Chat service (co-psychologist-ai) currently runs 3 replicas; needs an explicit SLA (recommend 99.5% for V1) once sold commercially |
| **Compliance** | Indonesia's Personal Data Protection Law (UU PDP) applies. Legal review required before any contract is signed. |
| **Auditability** | All escalation actions (EPIC-04) and all Super Admin privilege changes (EPIC-09) must be logged with timestamp and actor |
| **Performance** | AI response streaming (SSE) must remain <2s to first token regardless of tenant count |
| **Clinical content review** | All content in EPIC-11 and EPIC-19 must pass clinical review (SKL-7 pattern) before going live |

---

## 13. Architecture Summary (for context, not a spec)

| Layer | Service | Status |
|---|---|---|
| AI Engine | co-psychologist-ai (FastAPI, Langchain, DeepSeek, Mem0) | Mature, running in production -- shared across all clients |
| B2C API/Web | tenang-api, tenang web app | Mature |
| B2B Chat | chat-engine-b2b, tenang-api-b2b (Azure Cosmos + Azure OpenAI) | Currently disabled (0 replicas) -- built for Mayapada specifically, not generalized |
| Assessment | n2cias-api-aie, n2cias-fe | Currently disabled (0 replicas) -- separate brand/domain |
| Client Web | mayapada-web (Next.js 15) | Mayapada's specific branded deployment; functional pages exist unmerged on dev/staging |

**Note:** mayapada-web is Mayapada's own deployment, not the shared Tenang for Business product surface. The next client should be provisioned onto the shared stack, isolated by company_id -- not given their own fork.

**Implication:** The fastest path to a B2B MVP is consolidation and hardening of existing dev-branch work, not new feature development from zero.

---

## 14. Release Plan

### Phase 1 -- B2B MVP (Target: Q3 2026)

**Core infrastructure (unblocks everything else):**
- Tenant data isolation, row-level tenancy, four-tier roles -- EPIC-07 (TEN-1, TEN-2)
- Super Admin console: tenant provisioning, role management, audit log -- EPIC-09
- Sales-to-Super-Admin handoff form and provisioning SLA -- EPIC-09 (SUP-12, SUP-13)
- Legal hold capability -- EPIC-07 (TEN-6)

**Tenant setup and employee access:**
- Company onboarding: tenant creation, admin invite, bulk-invite with preview -- EPIC-01 (ONB-1 to ONB-9)
- Employee registration, OTP, profile setup -- EPIC-02 (EMP-1 to EMP-9)
- Company branding and preferences -- EPIC-10
- B2B/B2C same-email conflict screen -- EPIC-02 (EMP-17)

**Core employee experience:**
- AI psychologist chat with persistent memory -- EPIC-03 (CHAT-1 to CHAT-9)
- **First-time user orientation screen** -- EPIC-02 (EMP-16): must ship with V1; misaligned first session is unrecoverable
- **First-session AI opening protocol** -- EPIC-03 (CHAT-13): clinical-team-approved; highest-stakes moment in the product
- **Post-session summary + mood prompt + recommendation screen** -- EPIC-03 (CHAT-14): retention depends on this
- **Return-after-absence re-engagement state** -- EPIC-03 (CHAT-15)
- **In-session crisis resource card (non-disruptive banner)** -- EPIC-03 (CHAT-16)
- Quota-exhausted state screen -- EPIC-06 (BILL-4)

**Safety and escalation:**
- **Written, legally-reviewed escalation & privacy policy** -- prerequisite for all escalation features; must be done before any other EPIC-04 work
- Risk detection queue with AI summary -- EPIC-04 (RISK-1, RISK-8)
- **Clinical staff notification mechanism** -- EPIC-04 (RISK-17): without this the risk queue is invisible
- Two-tier priority queue (standard + critical) -- EPIC-04 (RISK-6)
- **Psychologist case assignment flow** -- EPIC-04 (RISK-18): escalation handoff is broken without this
- Backup assignee and SLA auto-escalation -- EPIC-04 (RISK-10, RISK-5)
- Emergency services action (119 checklist) -- EPIC-04 (RISK-12)
- Employee unreachable protocol -- EPIC-04 (RISK-19)
- Resolution authority gate -- EPIC-04 (RISK-20)
- After-hours on-call paging -- EPIC-04 (RISK-15)
- Case closure notification to employee -- EPIC-04 (RISK-16)
- Aggregate anonymized risk visibility for Company Admin -- EPIC-04 (RISK-3)

**Company Admin console:**
- Usage analytics, roster management, billing status -- EPIC-05 (ADM-1 to ADM-7)
- **Proactive low-adoption alert** -- EPIC-05 (ADM-11)
- **Company admin activity log** -- EPIC-05 (ADM-12)
- Admin role transfer and Super Admin reassign -- EPIC-05 (ADM-8, ADM-9)
- Support ticket on behalf of employee -- EPIC-05 (ADM-10)

**Billing:**
- Quota-based billing; billing tier configuration -- EPIC-06 (BILL-1, BILL-2)
- Mid-session quota protection -- EPIC-06 (BILL-8)

**Client lifecycle:**
- Crisis resource quick-access button (safety baseline)
- Client go-live verification checklist -- EPIC-09 (SUP-13)
- Client health alerting and renewal trigger -- EPIC-09 (SUP-14, SUP-15)

### Phase 2 -- Scale & Monetize (Target: Q4 2026)

**Monetization:**
- Pay-as-you-go billing + automated invoicing -- EPIC-06 (BILL-3)
- Freemium & trial tier -- EPIC-17
- Scheduled billing tier changes -- EPIC-06 (BILL-9)

**Growth:**
- Self-serve company signup (remove sales dependency for SMB tier)
- N2CIAS assessment module -- EPIC-08

**Employee engagement (utilization drivers):**
- Mood check-in & daily pulse -- EPIC-14
- Goal-setting & progress tracking -- EPIC-15 (uses existing Mem0; low infra cost)
- Self-guided content library -- EPIC-11 (basic category set; requires clinical content authoring)
- Skills & techniques library -- EPIC-19 (requires clinical content review workflow to be set up first; see Open Question #8)
- Bookmarks & saved moments -- EPIC-18
- Notifications & engagement -- EPIC-12

**HR value:**
- Workforce analytics: benchmark + departmental -- EPIC-16
- Pulse survey -- EPIC-12 (ENG-7)

**Enterprise integration:**
- HRIS & SSO integration -- EPIC-13 (start with one HRIS connector; SSO is procurement blocker for large clients)

**Clinical:**
- Formal clinical escalation SLA with staffing plan (headcount model for Tenang's pooled clinical team)
- Case outcome tracking -- EPIC-04 (RISK-9)
- Chronic-risk pattern detection -- EPIC-04 (RISK-11)
- Post-escalation skill assignment -- EPIC-19 (SKL-6)

### Phase 3 -- Expand (2027)
- Multi-language support
- Native mobile app
- White-labeling for large enterprise/channel partners
- Payroll/HRIS platform channel partnership for SMB distribution
- B2C transition path for employees leaving a company

---

## 15. Critical Path to Phase 1 Launch

### 15.1 Critical Path Sequence

```
 Legal/compliance review (UU PDP)        Engineering audit of
 + draft escalation & privacy policy      dev/staging branches
      [EPIC-04, RISK-3]   ------+    +------ [Section 13]
                                 |    |
                                 v    v
                    Decision: build vs. rebuild
                    B2B multi-tenant infrastructure
                                 |
                                 v
        EPIC-07 -- Multi-Tenant Data Isolation   +   EPIC-09
        (TEN-1 row-level tenancy, TEN-2 roles)        Super Admin console
                                 |                         |
                                 v                         |
                    EPIC-01 -- Company Onboarding <--------+
                                 |
                                 v
              EPIC-02 -- Employee Onboarding & Auth
                                 |
                                 v
   EPIC-03 -- AI Chat wired into tenant context  +  EPIC-04 risk thresholds
                                 |
                                 v
                EPIC-05 -- Company Admin Console
                                 |
                                 v
              EPIC-06 -- Quota Billing (basic, no PAYG)
                                 |
                                 v
   Design-partner pilot (one client beyond Mayapada, end-to-end)
                                 |
                                 v
       PHASE 1 LAUNCH
```

### 15.2 Critical Path Items

| Step | Item | Blocks | Owner |
|---|---|---|---|
| 1a | Legal/compliance review (UU PDP) + written escalation & privacy policy | EPIC-04, EPIC-07, sales contracts | Legal / Clinical Lead |
| 1b | Engineering audit of dev/staging branches | Build-vs-rebuild decision | Eng Lead |
| 2 | Build-vs-rebuild decision for B2B multi-tenant infra | EPIC-07 | CPO + Eng Lead |
| 3 | EPIC-07 + EPIC-09 | EPIC-01, EPIC-05, EPIC-06 | Engineering |
| 4 | EPIC-01 -- Company Onboarding | EPIC-02, EPIC-05 | Eng + Ops |
| 5 | EPIC-02 -- Employee Onboarding & Auth | EPIC-03 | Engineering |
| 6 | EPIC-03 + EPIC-04 | EPIC-05 | Eng + Clinical |
| 7 | EPIC-05 -- Company Admin Console | Pilot | Engineering |
| 8 | EPIC-06 -- Quota Billing | Pilot | Eng + Finance |
| 9 | Design-partner pilot (a client other than Mayapada) | Phase 1 Launch | CPO + Sales |

### 15.3 The Actual Bottleneck

The longest pole isn't engineering -- it's **Step 1a**. Legal/compliance review and the written escalation policy gate almost everything downstream. **Start this in week one, in parallel with the engineering audit -- not after engineering has something to demo.**

### 15.4 Off the Critical Path (Parallelizable -- Doesn't Block Launch)

- EPIC-10 (Company Branding) -- improves pitch but pilot can run on default branding
- EPIC-11 through EPIC-19 -- Phase 2
- Pay-as-you-go billing + automated invoicing (BILL-3) -- Phase 2
- Self-serve company signup -- Phase 2
- Multi-language support, native mobile, white-labeling -- Phase 3

---

## 16. Assumptions & Dependencies

- The Mayapada relationship continues in parallel and does not block re-architecture toward true multi-tenancy
- Legal/Compliance review of UU PDP can complete within the Phase 1 timeline -- **hard dependency, not a parallel track** (see Section 15.3)
- DeepSeek and Azure OpenAI inference costs remain stable enough to model unit economics (Section 6) -- needs Finance validation
- The existing dev/staging branch code is functionally close to production-ready; needs an engineering audit before committing to the Phase 1 date

---

## 17. Open Questions & Risks

| # | Question | Why it matters |
|---|---|---|
| 1 | What exactly triggers a "red flag" / high-risk classification? Currently undocumented at the AI-engine level. | This is the core safety mechanism of the entire product -- cannot stay undocumented past Phase 1 planning |
| 2 | Who staffs Tenang's own clinical escalation team, and at what cost per case, as the client base grows? | Every client gets the same human-follow-up guarantee. Needs a staffing and pricing model before Sales can promise it. |
| 3 | Should Super Admin and Company Admin be fully separate consoles, or one console with role-based views? | Affects EPIC-09 build scope and timeline directly |
| 4 | Can the B2B chat infrastructure (currently Mayapada-specific, Azure Cosmos-based, disabled) generalize to N tenants, or does it need a rebuild on the primary stack? | Major build-vs-rebuild decision that materially affects the critical path (Section 15, Step 2) |
| 5 | What's the actual unit cost per session (LLM inference + infra) at current usage? | Needed to validate the quota+PAYG pricing model before it's sold to customers |
| 6 | Who authors the self-guided content in EPIC-11 -- in-house clinical team, or licensed/curated third-party material? | Directly affects EPIC-11's Phase 2 timeline and cost |
| 7 | What is the minimum group size before departmental mood/usage data is shown in EPIC-16? | Privacy design decision that must be locked down before EPIC-16 is built |
| 8 | Who owns the clinical content review workflow for EPIC-19 skills, and what is the review cadence and sign-off authority? | SKL-7 requires clinical approval before any skill goes live. Needs a named owner and a process before EPIC-19 enters development. |
| 9 | Does a freemium trial (EPIC-17) require a separate sales/legal agreement, or is it self-serve with click-through terms? | Determines whether Phase 2 self-serve signup is a prerequisite for EPIC-17 |
| 10 | What is the after-hours on-call staffing model for RISK-15? | If no human can acknowledge a critical-risk page at 3am, the platform must be honest about this gap -- not imply help is coming when it isn't. Must be resolved before Phase 1 launch. |
| 11 | What is the exact content of the first-session AI greeting (CHAT-13)? Who approves it? | The AI's first message to a first-time user is the highest-stakes moment in the product. It cannot be left to the model's default behavior -- it needs clinical review and a defined opening protocol. |
| 12 | Who is the named authority that can mark an escalation case as resolved (RISK-20)? | Defines the escalation governance structure and determines what "senior clinical staff" means in terms of staffing and hierarchy. |
| 13 | What is the SLA for a psychologist to make first contact after being assigned a case (RISK-18)? | The gap between "clinical staff triages" and "psychologist calls the employee" is the highest-risk window in the escalation flow. Must be defined before Phase 1 launch. |
| 14 | What does the invitation email actually say? Who writes and approves it? | The invitation email is the single most read piece of content in the entire product. Every employee sees it before deciding whether to engage. It is currently undocumented. |
| 15 | Who writes and clinically approves the first-session AI opening protocol (CHAT-13) and the re-engagement state (CHAT-15)? What is the review and update cycle? | These are the two highest-stakes AI messages in the product. They need named clinical ownership and a documented approval process. |
| 16 | What is the contact method for psychologist follow-up (RISK-18, Journey E)? Phone only? Tenang-mediated secure message? Does the employee ever need to consent to being contacted? | Determines what employee data the platform needs to collect and store, and whether consent is required at registration (EMP-2). |
| 17 | Who is "senior clinical staff" for the purposes of RISK-20 (resolution authority) and RISK-19 (unreachable escalation)? How many people hold this role at launch? | Cannot design the resolution gate without knowing the org structure of Tenang's clinical team. Must be resolved before EPIC-04 enters development. |

---

## 18. Out of Scope (Explicit Non-Goals for this PRD)

- This document does not redefine the AI conversation design/prompting strategy -- owned by the AI/Clinical team
- This document does not set final pricing -- Finance/Sales own the pricing model
- This document does not cover the N2CIAS assessment instrument content itself, only its packaging as an add-on (EPIC-08)
- This document does not address whether/how the existing mayapada-web deployment gets migrated onto the shared multi-tenant stack -- that's a separate migration plan
- This document does not specify the actual content of EPIC-11 programs or EPIC-19 skills -- those are clinical content workstreams

---

## Appendix A -- Traceability: Source SRS to PRD Epic

| SRS Section | PRD Epic |
|---|---|
| AI Session Lifecycle, Standalone Chat, User Insights (AI-Engine-Docs) | EPIC-03 |
| B2B Enterprise / Enterprise Chat (Infra-Docs) | EPIC-07 |
| Employee Assessment / N2CIAS (Infra-Docs) | EPIC-08 |
| Mental Health Consultation / AI Psychologist Chat (Infra-Docs) | EPIC-03, EPIC-04 |
| Patient Registration & Onboarding (Web-Docs) | EPIC-02 |
| Patient Chat Session (Web-Docs) | EPIC-03 |
| Internal Staff Dashboard (Web-Docs) | EPIC-05 |
| Internal Team Management (Web-Docs) | EPIC-01 |
| Unmerged Features: Billing, Packages, Multi-Tenant, Admin Dashboard | EPIC-06, EPIC-07, EPIC-01 |
| Role constants USER_ROLE / INTERNAL_ROLE / ADMIN_ROLE / SUPER_ADMIN_ROLE | EPIC-09 |
| Not in source -- mayapada-web branding is hardcoded, not configurable | EPIC-10 |
| Not in source -- validated by Talkspace, Limbic Care | EPIC-11 |
| Not in source -- validated by all three competitors | EPIC-12 |
| Not in source -- validated by Talkspace enterprise tier | EPIC-13 |
| Not in source -- validated by Woebot daily mood, Talkspace habit loop | EPIC-14 |
| Not in source -- validated by Limbic goal-setting, Talkspace progress tracking | EPIC-15 |
| Not in source -- validated by Talkspace Engage benchmarks | EPIC-16 |
| Not in source -- validated by Talkspace, Woebot pre-B2B consumer model | EPIC-17 |
| Not in source -- validated by Woebot saved tools, Day One | EPIC-18 |
| Not in source -- validated by Woebot CBT/DBT skill modules, Limbic activity courses | EPIC-19 |

---

## Appendix B -- Feature Opportunity Map (from Competitive Research)

### B.1 Employee Experience

| Feature | Inspired By | Value | Effort | Horizon |
|---|---|---|---|---|
| Self-guided program library | Talkspace (70+ programs), Limbic (CBT courses) | High | Medium | Phase 2 (EPIC-11) |
| Mood check-in / daily pulse | Woebot, Talkspace | High | Low | Phase 2 (EPIC-14) |
| Progress tracking & milestones | Talkspace | Medium | Low | Phase 2 (EPIC-15) |
| Goal-setting within chat | Limbic | Medium | Medium | Phase 2 (EPIC-15) |
| Journaling / reflective prompts | Talkspace self-guided app | Medium | Low | Phase 2 (EPIC-11) |
| Skills & techniques library | Woebot CBT/DBT modules, Limbic activities | High | Medium | Phase 2 (EPIC-19) |
| Bookmarks & saved moments | Woebot saved tools | High | Low | Phase 2 (EPIC-18) |
| Crisis resource quick-access | All three competitors | High | Low | Phase 1 (safety baseline) |
| Native mobile app | All three competitors | High | High | Phase 3 |
| Voice input to chat | Talkspace async audio | Medium | Medium | Phase 3 |

### B.2 HR Admin Experience

| Feature | Inspired By | Value | Effort | Horizon |
|---|---|---|---|---|
| Utilization benchmark comparison | Talkspace Engage | High | Medium | Phase 2 (EPIC-16) |
| Departmental / team-level analytics | Talkspace Engage | High | Medium | Phase 2 (EPIC-16) |
| Downloadable QBR report | Talkspace Engage | High | Low | Phase 1-2 (ADM-5) |
| Pulse survey | -- | Medium | Low | Phase 2 (ENG-7) |
| Industry-specific onboarding guides | Talkspace | Medium | Low | Phase 2 (content asset, not product feature) |
| Sentiment trend heatmap | -- | Medium | High | Phase 3 |

### B.3 Clinical / Safety Experience

| Feature | Inspired By | Value | Effort | Horizon |
|---|---|---|---|---|
| AI-generated case hand-off summary | Limbic clinical AI scribe | High | Medium | Phase 2 (RISK-8) |
| Two-tier risk queue (standard + critical) | -- | High | Low | Phase 1 (RISK-6) |
| Case outcome tracking | Limbic recovery rate tracking | High | Medium | Phase 2 (RISK-9) |
| Assign skills post-escalation | -- | High | Low | Phase 2 (SKL-6) |
| Configurable risk threshold tuning per tenant | Woebot modular SaMD | High | High | Phase 2 |
| Population-level wellbeing report | Limbic population health | Medium | Medium | Phase 3 |

### B.4 Platform & Infrastructure

| Feature | Inspired By | Value | Effort | Horizon |
|---|---|---|---|---|
| SSO (SAML 2.0 / OIDC) | Talkspace enterprise tier | High | Medium | Phase 2 (EPIC-13) |
| HRIS sync | Talkspace enterprise tier | High | High | Phase 2 (EPIC-13) |
| Webhook / API for HR platform integration | -- | Medium | Medium | Phase 3 |
| Regulated SaMD pathway (BPOM) | Woebot | High | Very High | Monitor |
| Offline / low-bandwidth mode | -- | Medium | High | Phase 3 |

### B.5 Monetization & Go-To-Market

| Feature | Inspired By | Value | Effort | Horizon |
|---|---|---|---|---|
| Self-serve signup | -- | High | Medium | Phase 2 |
| Freemium / trial tier | Talkspace, Woebot | Medium | Medium | Phase 2 (EPIC-17) |
| Payroll/HRIS platform channel partnership | Woebot x PayrollPlans | High | Low (BD effort) | Phase 3 |
| Outcome-based proof assets (case study) | Talkspace outcome study | High | Medium | Phase 2 (collect data now) |
| Industry vertical packages | Talkspace | Medium | Low | Phase 2 |

### B.6 Priority Matrix Summary

| | **Low Effort** | **High Effort** |
|---|---|---|
| **High Value** | Crisis button (Phase 1), Mood check-in (Phase 2), QBR report (Phase 1-2), SSO (Phase 2) | HRIS sync (Phase 2), Self-guided content (Phase 2), Native mobile (Phase 3) |
| **Medium Value** | Journaling prompts (Phase 2), Freemium tier (Phase 2), Industry packages (Phase 2) | Departmental analytics (Phase 2), Sentiment heatmap (Phase 3) |

---

*Next step: review Sections 17 (Open Questions) and 15 (Critical Path) with Engineering and Clinical leads before this PRD is finalized for sprint planning.*

*Highest-priority open questions before Phase 1 can start: #1 (risk flag thresholds), #10 (after-hours on-call model), #12 (resolution authority for RISK-20), #13 (psychologist contact SLA), #14 (invitation email content), #15 (CHAT-13 and CHAT-15 clinical approval), #17 (senior clinical staff definition). All of these gate engineering work, not just policy. They must be resolved in week one, not deferred.*
