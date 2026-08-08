# Haro Memory Fabric

MCP server providing mem0 (conversational memory), gbrain (knowledge graph),
vault (file storage), and **tenant management** tools for the Haro AI ecosystem.

## Dev

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
python -m memory_fabric.server
```

## Deploy

```bash
cp deploy/memory-fabric-mcp.service /etc/systemd/system/
cp deploy/env /etc/memory-fabric-mcp/env
systemctl daemon-reload
systemctl enable --now memory-fabric-mcp
```

## API Proxy

The REST API proxy runs on port `8771` — serves MCP tools and tenant management endpoints behind Caddy (`haro-proxy.treonstudio.com`).

```bash
source /etc/memory-fabric-mcp/env
nohup /opt/memory-fabric-mcp-venv/bin/python -m uvicorn \
  memory_fabric.proxy_api:app --host 127.0.0.1 --port 8771 --workers 1 \
  > /var/log/proxy-api.log 2>&1 &
```

## Tenant Management

Full CRUD for multi-tenant provisioning with per-tenant vault directories and gbrain env files.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | Backend health check |
| `PUT` | `/api/tenants/provision` | Bearer | Provision new tenant |
| `GET` | `/api/tenants` | Bearer | List tenants (paginated, filterable) |
| `GET` | `/api/tenants/{slug}` | Bearer | Get tenant detail |
| `GET` | `/api/tenants/{slug}/stats` | Bearer | Usage vs quota stats |
| `GET` | `/api/tenants/{slug}/audit-log` | Bearer | Per-tenant audit log |
| `GET` | `/api/tenants/audit-log` | Bearer | Global audit log |
| `POST` | `/api/tenants/{slug}/suspend` | Bearer | Suspend tenant |
| `POST` | `/api/tenants/{slug}/reactivate` | Bearer | Reactivate tenant |
| `POST` | `/api/tenants/{slug}/schedule-delete` | Bearer | Schedule deletion |

Auth: `Authorization: Bearer <MANAGEMENT_API_KEY>`.

### Daily Cleanup Cron

Removes soft-deleted tenants (30 days after `deleted_at`), vault dirs, and env files:

```bash
cp deploy/tenant-cleanup.{service,timer} /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now tenant-cleanup.timer
```

### Tests

```bash
/opt/memory-fabric-mcp-venv/bin/python -m pytest tests/ -v -q
```

### Database

Migration file: `../website/scripts/migrations/003-tenants.sql`

```bash
psql "$NEON_DATABASE_URL" -f ../website/scripts/migrations/003-tenants.sql
```

### Setup Docs

See [`docs/tenant-management-setup.md`](docs/tenant-management-setup.md) for full E2E test commands, architecture diagram, and file reference.

## 100 Use Cases for Haro

### Mental Wellness — Individual Users

1. Daily mood check-in with AI therapist that remembers your history
2. Guided CBT (cognitive behavioral therapy) exercises for anxiety
3. Journaling with AI prompts based on your emotional patterns
4. Sleep hygiene coach — tracks insomnia patterns and suggests routines
5. Panic attack first aid — step-by-step grounding exercises
6. Grief counseling with persistent memory of your loss journey
7. Social anxiety exposure planning with gradual challenge builder
8. Anger management — trigger tracking and de-escalation techniques
9. Self-esteem building with personalized affirmation generation
10. Burnout recovery plan based on work-stress pattern analysis
11. Mindfulness meditation guided by your current emotional state
12. Relationship conflict reflection with third-party perspective
13. Post-trauma coping with customizable trigger warnings
14. Addiction recovery accountability partner (24/7 available)
15. ADHD focus coaching with task breakdown and reminder loops
16. Impostor syndrome reframing with achievement log review
17. Perfectionism therapy — setting "good enough" thresholds
18. Chronic pain management — CBT-pain coping strategies
19. Life transition support (divorce, relocation, career change)
20. LGBTQ+ identity exploration in a safe, judgment-free space

### HR & Workplace Wellbeing (B2B Tenang)

21. Company-wide anonymous stress pulse surveys
22. Manager coaching for handling team mental health conversations
23. New parent return-to-work transition support program
24. Remote worker loneliness detection and intervention
25. High-performer burnout prevention (usage-triggered check-ins)
26. Post-layoff team morale rebuilding toolkit
27. DEI (Diversity, Equity, Inclusion) microaggression reporting with AI triage
28. Workplace bullying documentation and escalation workflow
29. Financial stress counseling integrated with EAP benefits
30. On-demand crisis support during after-hours for shift workers
31. Department-level anonymized wellbeing trends for HR dashboards
32. Pre-meeting anxiety quick-decompression (1-minute exercises)
33. Conflict resolution mediator between team members
34. Compassion fatigue support for healthcare and social workers
35. Custom wellness challenge tracking (steps, sleep, mindfulness minutes)

### Clinical Staff & Escalation

36. Real-time red-flag alert dashboard with severity triage
37. AI-generated clinical summary for psychologist handoff
38. Session note drafting from chat history
39. Risk assessment scoring with evidence log
40. Follow-up SLA tracking (24h for high-risk cases)
41. Incident report auto-generation for mandatory reporting
42. Multi-client caseload overview with priority sorting
43. Intervention effectiveness tracking across patient cohorts
44. Clinical audit trail export for compliance
45. Escalation decision support — AI suggests when to involve human clinician

### Super Admin & Platform Operations

46. Tenant provisioning dashboard with onboarding wizard
47. Billing overage alerts and automated invoice generation
48. Quota utilization monitoring across all tenants
49. Suspicious activity detection (unusual usage patterns)
50. Audit log export for SOC2 compliance
51. Feature flag toggling per tenant (A/B test new features)
52. Data retention policy enforcement (auto-delete idle tenants)
53. Custom plan configuration (quotas, limits, pricing)
54. System health monitoring with multi-backend status (mem0, gbrain, vault)
55. Usage forecast modeling for capacity planning

### Knowledge Graph (gbrain)

56. Company policy Q&A — employees ask "what's our parental leave policy?"
57. Onboarding knowledge base — new hires learn company history and org structure
58. Meeting minutes search — find decisions from past meetings by topic
59. Codebase documentation — developers query architecture decisions
60. Product spec versioning — track design rationale over time
61. Regulatory compliance — instant lookup of relevant regulations
62. Competitive intelligence — structured research repository
63. Therapy techniques catalog — indexed CBT/DBT/ACT interventions
64. Crisis protocol lookup — step-by-step emergency procedures
65. Clinical research library — query latest mental health studies
66. Training material generator — create onboarding docs from knowledge graph
67. Common FAQ auto-answer for support teams
68. Cross-reference symptom → treatment → specialist network
69. Organizational chart with role descriptions and team mission
70. Project retrospective knowledge base — lessons learned indexed by theme

### Voice Assistant (Ara)

71. Hands-free journaling while cooking or commuting
72. Voice-activated mood check before sleep
73. Smart home integration — "turn off lights and set sleep mode"
74. Calendar management — "schedule therapy session next Tuesday"
75. Medication reminder with voice confirmation
76. Breathing exercise guided by voice with haptic feedback
77. Morning briefing — weather, calendar, mood trend of the week
78. Kitchen timer + recipe reading hands-free
79. Emergency voice shortcut — "I need help now" triggers crisis protocol
80. Language learning partner with pronunciation feedback

### LLM Gateway & Routing

81. Automatic fallback when primary LLM is down (no downtime)
82. Cost-optimized routing — cheap model for simple queries, premium for complex
83. Response caching for common questions (lower latency, lower cost)
84. Rate limiting per tenant to prevent abuse
85. Multi-model A/B comparison for response quality monitoring
86. PII redaction before sending to LLM providers
87. Content moderation guardrails — block harmful prompts
88. Response latency SLAs by tenant tier
89. Streaming vs non-streaming routing based on use case
90. Custom model fine-tuning dataset collection from approved conversations

### Memory (mem0)

91. Cross-session continuity — AI remembers your last conversation topic
92. Preference learning — adapts tone, depth, and style over time
93. Trigger pattern recognition — identifies recurring themes in your sessions
94. Progress tracking — "you've been less anxious than last month"
95. Relationship maps — AI tracks people and dynamics you discuss over time

### File Storage (vault)

96. Secure upload of therapy worksheets and homework
97. Mood tracking spreadsheet auto-analysis
98. Genogram (family tree) drawing storage for therapy
99. Insurance document vault with encrypted access
100. Custom workbook creation from AI-curated exercise library
