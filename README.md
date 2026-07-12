# Haro Monorepo

**Haro** is the AI ecosystem by Treon Studio — a collection of products and services for
conversational AI, mental wellness, voice assistance, and LLM tooling.

## Projects

| Path | Package | Description |
|------|---------|-------------|
| `apps/website` | `@treonstudio/website` | **Tenang** — AI mental wellness web app (Astro 5 + React 19, Cloudflare Workers) |
| `apps/haro-voice` | — | **Ara** — Python voice assistant (openWakeWord, MiniMax STT/TTS, OpenRouter LLM, FastAPI) |
| `apps/memory-fabric` | — | Python MCP server for mem0 (memory), gbrain (knowledge graph), vault (file storage), tenant management, usage counters, quota enforcement, resource snapshots |
| `apps/haro-gateway` | `@treonstudio/gateway` | AI proxy gateway — routes to 250+ LLMs with fallbacks, caching, guardrails (based on Portkey AI Gateway) |
| `apps/mcp` | `@treonstudio/mcp` | "OKF" MCP Server for knowledge graph navigation |
| `packages/core` | `@treonstudio/bungas-core` | Shared React 19 UI primitives (shadcn), hooks, utils |
| `packages/ts-config` | `@treonstudio/ts-config` | Shared TypeScript configurations |

## Quick Start

```bash
# Install dependencies (website/gateway)
pnpm install

# Run website locally
pnpm dev

# Build website
pnpm build

# Check types & lint
pnpm check
pnpm lint

# Run tests
pnpm test
```

## Deployed Services

| Service | URL | Description |
|---------|-----|-------------|
| Tenang website | [haro-web.treonstudio.workers.dev](https://haro-web.treonstudio.workers.dev) | Astro 5 marketing site + admin dashboard (Cloudflare Workers) |
| Memory Fabric proxy | [haro-proxy.treonstudio.com](https://haro-proxy.treonstudio.com) | REST API for MCP tools + tenant management (Caddy → systemd, port 8771) |
| Admin dashboard | [haro-web.treonstudio.workers.dev/dashboard/admin/tenants](https://haro-web.treonstudio.workers.dev/dashboard/admin/tenants) | Tenant management UI with memory browser, knowledge graph, vault, activity log |
| API health check | [haro-proxy.treonstudio.com/api/health](https://haro-proxy.treonstudio.com/api/health) | Backend health endpoint |
| GitHub | [github.com/Treon-Studio/haro](https://github.com/Treon-Studio/haro) | Source code monorepo |

## Connecting to Services

### Website (Tenang)

Open [haro-web.treonstudio.workers.dev](https://haro-web.treonstudio.workers.dev) in a browser. Sign in via Supabase auth (email/password or OAuth). The admin dashboard is at [/dashboard/admin/tenants](https://haro-web.treonstudio.workers.dev/dashboard/admin/tenants).

### Memory Fabric API

All REST endpoints are behind `haro-proxy.treonstudio.com`. Authenticate with `MANAGEMENT_API_KEY`:

```bash
export MF_KEY="your-management-api-key"

# Health check
curl https://haro-proxy.treonstudio.com/api/health

# List tenants
curl -H "Authorization: Bearer $MF_KEY" \
  https://haro-proxy.treonstudio.com/api/tenants

# Provision a new tenant
curl -X PUT https://haro-proxy.treonstudio.com/api/tenants/provision \
  -H "Authorization: Bearer $MF_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug":"my-tenant","name":"My Tenant"}'

# Get tenant stats (usage vs quota)
curl -H "Authorization: Bearer $MF_KEY" \
  https://haro-proxy.treonstudio.com/api/tenants/my-tenant/stats

# View audit log
curl -H "Authorization: Bearer $MF_KEY" \
  https://haro-proxy.treonstudio.com/api/tenants/audit-log

# Suspend tenant
curl -X POST https://haro-proxy.treonstudio.com/api/tenants/my-tenant/suspend \
  -H "Authorization: Bearer $MF_KEY"
```

### MCP Client (Python)

```python
from memory_fabric.client import MemoryFabricClient

client = MemoryFabricClient(
    base_url="https://haro-proxy.treonstudio.com",
    api_key="your-management-api-key"
)

# List tenants
tenants = await client.list_tenants()

# Search memories
memories = await client.search_memories(
    tenant_slug="my-tenant",
    query="meeting notes"
)

# Upload file to vault
await client.upload_vault_file(
    tenant_slug="my-tenant",
    file_path="/reports/q1.pdf",
    content=b"..."
)

# Query knowledge graph
result = await client.query_gbrain(
    tenant_slug="my-tenant",
    query="company policy on leave"
)
```

### MCP Client (Claude Desktop / Cursor)

Add to your MCP client config:

```json
{
  "mcpServers": {
    "memory-fabric": {
      "command": "python",
      "args": ["-m", "memory_fabric.server"],
      "env": {
        "MEM0_API_KEY": "...",
        "GBRAIN_API_KEY": "...",
        "VAULT_PATH": "/srv/vault-write",
        "NEON_DATABASE_URL": "..."
      }
    }
  }
}
```

### Obsidian

#### Via MCP Tools Plugin

Install [MCP Tools](https://github.com/Quorafind/obsidian-mcp-tools) from Obsidian Community Plugins. Add to its config:

```json
{
  "mcpServers": {
    "memory-fabric": {
      "command": "python",
      "args": ["-m", "memory_fabric.server"],
      "env": {
        "MEM0_API_KEY": "...",
        "GBRAIN_API_KEY": "...",
        "VAULT_PATH": "/srv/vault-write",
        "NEON_DATABASE_URL": "..."
      }
    }
  }
}
```

Then use MCP tools from Obsidian: search memories, query knowledge graph, read/write vault files.

### Via WebDAV (Obsidian Live Sync, Remotely Save)

Mount the vault directory as a WebDAV share using a reverse proxy (e.g., Caddy with `webdav` handler). Then configure [Remotely Save](https://github.com/remotely-save/remotely-save) in Obsidian:

```
Plugin: Remotely Save
  → Remote type: WebDAV
  → URL: https://haro-proxy.treonstudio.com/vault/
  → Auth: Basic (username + MANAGEMENT_API_KEY)
```

### Via Vault REST API (Custom Sync)

Upload/download files programmatically:

```bash
# List files in vault
curl -H "Authorization: Bearer $MF_KEY" \
  https://haro-proxy.treonstudio.com/api/tenants/my-tenant/vault?prefix=notes/

# Download a file
curl -H "Authorization: Bearer $MF_KEY" \
  https://haro-proxy.treonstudio.com/api/tenants/my-tenant/vault/notes/daily.md \
  -o daily.md

# Upload a file
curl -X PUT https://haro-proxy.treonstudio.com/api/tenants/my-tenant/vault/notes/daily.md \
  -H "Authorization: Bearer $MF_KEY" \
  -H "Content-Type: text/markdown" \
  -d "$(cat daily.md)"
```

## 100 Daily Use Cases

### Pagi Hari (Morning Routine)

1. Alarm cerdas — "Bangunin jam 5, cek cuaca, kasih tau jadwal hari ini"
2. Mood check pagi — "Gimana mood lo pagi ini?" terus nyaranin aktivitas sesuai mood
3. Daily briefing — ringkasan cuaca, kalender, berita, dan tugas hari ini dalam 1 menit
4. Afirmasi pagi — generate afirmasi positif berdasarkan goals yg lagi lo kejar
5. Journaling pagi — nulis 3 hal yang lo syukuri hari ini
6. Sarapan planner — rekomendasi menu berdasarkan isi kulkas (vault)
7. Workout reminder — ingetin stretching/olahraga pagi + tracking progress
8. Meditasi guided — 5 menit breathing exercise sebelum mulai kerja
9. Prioritasku — bantu urutin tugas hari ini berdasarkan urgency dan energy level
10. Morning debrief — "Apa yg terjadi kemarin? Ada follow-up?"

### Produktivitas & Kerja

11. Meeting notes — rekam dan rangkum meeting, simpan ke vault
12. Action items — ekstrak todo dari meeting notes, kirim reminder
13. Daily standup — generate standup report dari aktivitas kemarin
14. Email draft — "Bales email soal deadline proyek, tone profesional"
15. Code review — tempel diff, minta review dalam bahasa Indonesia
16. Brain dump — catat ide random, nanti diorganisir otomatis
17. Research assistant — "Cari best practice microservices 2026, simpen ke gbrain"
18. Dokumen summarizer — upload PDF panjang, dapet ringkasan 3 paragraf
19. Meeting notes — rekam obrolan, simpen ke vault, generate action items
20. Follow-up reminder — "Ingetin gw follow-up email klien jam 3 sore"

### Tengah Hari (Midday)

21. Lunch planner — rekomendasi menu berdasarkan sisa bahan di vault
22. Belanja list — "Gw mau masak rendang, apa aja yg perlu dibeli?"
23. Resep masak — step-by-step dari bahan yg ada
24. Power nap timer — "Ingetin gw 20 menit, trus bangunin"
25. Afternoon boost — playlist atau afirmasi buat ngelawan ngantuk
26. Stretch reminder — "Udah 2 jam duduk, berdiri dan stretching 5 menit"
27. Hydration tracker — "Udah minum berapa gelas hari ini?"
28. Quick journal — catat 3 hal yg terjadi sebelum lunch
29. Belanja list — "Tambahin beras dan minyak ke shopping list"
30. Resep improvisasi — "Apa yg bisa gw masak dari sisa bahan di vault?"

### Sore Hari (Afternoon)

31. Post-lunch brain dump — catat ide random sebelum lupa
32. Task check-in — "Apa yg udah gw selesain? Apa yg masih pending?"
33. Energy reset — 5 menit napas dalam + afirmasi biar fokus lagi
34. Belajar tracker — "Gw lagi belajar Python, rangkumin progress 2 minggu terakhir"
35. Note organizer — sortir dan tag catatan yg berantakan di vault
36. Reschedule — "Geser meeting jam 2 ke jam 4, update semua kalender"
37. Quick research — "Cari tau perbedaan REST dan GraphQL, simpen ke gbrain"
38. Expense catat — "Tambahin pengeluaran: gopay 25rb untuk makan siang"
39. Gratitude log — catat 1 hal baik yg terjadi hari ini
40. Ide capture — "Rekam ide aplikasi baru, simpen ke vault"

### Sore/Malam Hari (Afternoon & Evening)

41. Workout log — "Catet: push up 30, squat 50, lari 2km"
42. Meal tracker — "Makan siang: nasi padang, estimasi 800 kalori"
43. Progress refleksi — "Apa yg gw pelajari hari ini?"
44. Brain dump — tumpahin semua pikiran sebelum tidar biar ga overthinking
45. Tomorrow prep — "Siapin jadwal besok, list tugas prioritas"
46. Gratitude journal — "Tulis 3 hal yg gw syukuri hari ini"
47. Mood tracker — "Gimana skala stress hari ini 1-10? Catet alasannya"
48. Sleep prep — "Mode malam: redupin lampu, puter white noise, matiin notif"
49. Dream log — "Catet mimpi semalem sebelum lupa"
50. Review hari — "Apa yg bisa gw perbaiki besok?"

### Kesehatan & Mental Wellness

51. Cek kecemasan — "Gw lagi cemas, kasih grounding exercise"
52. Panic attack first aid — step-by-step 5-4-3-2-1 grounding
53. Sleep tracker — "Tidur cuma 5 jam semalem, saranin jadwal tidur"
54. Habit tracker — "Catet: minum vitamin, baca 10 halaman, meditasi 5 menit"
55. Workout log — "Push up 30, squat 50, lari 2km — simpen ke vault"
56. Sakit kepala — "Cek pola: kurang minum? kurang tidur? stress?"
57. Journaling prompt — "Kasih pertanyaan journaling berdasarkan mood seminggu terakhir"
58. Screen time alert — "Udah 3 jam main HP, saranin aktivitas offline"
59. Digital detox — "Mode fokus: blokir notif 2 jam, tracking progress"
60. Affirmation generator — "Generate afirmasi berdasarkan goals yg lagi gw kejar"

### Pekerjaan & Produktivitas

61. Email writer — "Bales email klien soal delay, tone profesional tapi empati"
62. Resume tailor — "Sesuaiin CV gw sama job desc ini"
63. Interview prep — "Bikin daftar pertanyaan dan jawaban berdasarkan pengalaman gw"
64. Code review — "Review PR ini, cari bug dan security issue"
65. Technical writer — "Bikin dokumentasi API dari kode ini"
66. Brainstorming partner — "Gw mau bikin fitur baru, temenin brainstorming"
67. Decision helper — "Pilih antara AWS dan GCP, kasih pro-con berdasarkan use case gw"
68. Learning path — "Gw mau belajar React Native dalam 30 hari, bikin roadmap"
69. Flashcard generator — "Bikin flashcards dari catatan kuliah di vault"
70. Second brain — "Cari ide yg gw tulis 3 bulan lalu tentang side project"

### Rumah Tangga & Lifestyle

71. Resep harian — "Apa yg bisa dimasak dari bahan di kulkas? Catet di vault"
72. Belanja bulanan — "Generate list belanja dari menu seminggu"
73. Budget tracker — "Catet pengeluaran hari ini, kategorikan otomatis"
74. Tagihan reminder — "Ingetin gw bayar listrik, internet, dan BPJS"
75. Kesehatan keluarga — "Catet jadwal imunisasi anak, kasih reminder"
76. Pekerjaan rumah — "Bagi tugas bersihin rumah buat sekeluarga"
77. Tanaman hias — "Kasih tau jadwal siram tanaman berdasarkan jenisnya"
78. Resep favorit — "Simpen resep turun-temurun ke vault, lengkap dengan foto"
79. Kulkas tracker — "Catet stok bahan makanan, kasih tau yg mau expired"
80. Liburan planner — "Bikin itinerary 3 hari ke Jogja, simpen ke gbrain"

### Keuangan & Hukum

81. Budget bulanan — "Tracking pengeluaran, kasih tau kalo udah overspend"
82. Investasi tracker — "Catet portofolio saham/kripto, rekap performa mingguan"
83. Tagihan scheduler — "Atur jadwal bayar tagihan biar ga kena denda"
84. Pajak prep — "Kumpulin bukti potong dan pengeluaran buat SPT tahunan"
85. Asuransi check — "Rekap polis asuransi, kasih tau yg mau expired"
86. Kontrak review — "Upload kontrakan/kontrak kerja, minta highlight poin penting"
87. Budget planner — "Bikin budget bulanan berdasarkan pengeluaran 3 bulan terakhir"
88. Wishlist tracker — "Catet barang yg mau dibeli, prioritasin berdasarkan budget"
89. Cicilan monitor — "Tracking sisa cicilan KPR/motor/kartu kredit"
90. Darurat dana — "Simulasi dana darurat: 6 bulan pengeluaran = Rp X"

### Sosial & Relasi

91. Birthday reminder — "Ingetin ultah temen minggu ini, saranin kado"
92. Chat draft — "Bales chat WhatsApp yg belum dibales, tone santai"
93. Argumen refleksi — "Gw abis debat sama pasangan, bantu liat dari sisi lain"
94. Gift ideas — "Kasih ide kado ultah buat bestie berdasarkan hobi dia"
95. Travel journal — "Catet perjalanan hari ini, simpen foto ke vault"
96. Party planner — "Bikin list tamu, menu, dan budget buat BBQ akhir pekan"
97. Networking tracker — "Catet orang yg baru dikenal, follow-up besok"
98. Volunteer log — "Tracking jam sosial, generate laporan buat sertifikat"
99. Community event — "Cari event weekend yg sesuai minat, simpen ke gbrain"
100. Daily gratitude broadcast — "Generate 3 hal baik hari ini, kirim ke grup keluarga"
- `apps/haro-voice/` — [Ara voice assistant](apps/haro-voice/README.md)
- `apps/memory-fabric/` — [Memory Fabric MCP server](apps/memory-fabric/README.md)
- `apps/haro-gateway/` — [AI gateway](apps/haro-gateway/README.md)
- `apps/mcp/` — [OKF MCP server](apps/mcp/README.md)
- `packages/core/` — [UI component library](packages/core/README.md)
- `packages/ts-config/` — [Shared TS configs](packages/ts-config/README.md)

## License

MIT — see [LICENSE.md](LICENSE.md).
