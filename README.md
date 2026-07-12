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

Plugin yg perlu diinstall:

| Plugin | Link | Fungsi |
|--------|------|--------|
| **Local REST API** | [community.obsidian.md/plugins/obsidian-local-rest-api](https://community.obsidian.md/plugins/obsidian-local-rest-api) — by coddingtonbear | MCP server bawaan — baca/tulis/search notes, query tags, execute commands. **Wajib** |
| **Remotely Save** | [community.obsidian.md/plugins/remotely-save](https://community.obsidian.md/plugins/remotely-save) — by fyears | Sync vault ke WebDAV (Haro vault) |
| **Dataview** (opsional) | [community.obsidian.md/plugins/dataview](https://community.obsidian.md/plugins/dataview) | Query metadata notes pake SQL-like |

#### Setup Local REST API + MCP

1. Install **Local REST API** dari Community Plugins → [obsidian-local-rest-api](https://github.com/coddingtonbear/obsidian-local-rest-api)
2. Settings → Local REST API → copy API key
3. Hubungkan MCP client ke `https://127.0.0.1:27124/mcp/` pake API key tsb

Contoh konek dari Claude Desktop / OpenCode:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "uvx",
      "args": ["mcp-obsidian"],
      "env": {
        "OBSIDIAN_API_KEY": "api-key-dari-plugin"
      }
    }
  }
}
```

#### Via WebDAV (Remotely Save)

Install [Remotely Save](https://community.obsidian.md/plugins/remotely-save) dari Community Plugins. Konfigurasi:

```
Plugin: Remotely Save
  → Remote type: WebDAV
  → URL: https://haro-proxy.treonstudio.com/vault/
  → Auth: Basic (username + MANAGEMENT_API_KEY)
```

#### Via Vault REST API (Custom Sync)

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

## 100 Daily Use Cases — Lengkap dengan Cara

### Pagi Hari (Morning Routine)

**1. Alarm Cerdas**
- **Akses**: Ara (voice) atau chat
- **Cara**: "Haro, bangunin gw jam 5 pagi, terus kasih tau cuaca dan jadwal hari ini"
- **Simpan**: Haro inget preferensi lo (jam bangun, format briefing) di mem0
- **Hasil**: Alarm bunyi → cuaca hari ini → 3 agenda teratas dari kalender

**2. Mood Check Pagi**
- **Akses**: Chat atau voice
- **Cara**: "Haro, gimana mood gw seminggu ini?" atau "Gw bangun dengan perasaan cemas"
- **Simpan**: Haro catet mood hari ini ke mem0, bandingin sama minggu lalu
- **Hasil**: "Minggu ini mood lo rata-rata 6/10, turun dari minggu lalu 7/10. Saran: coba 5 menit journaling gratitude"

**3. Daily Briefing**
- **Akses**: Chat atau voice
- **Cara**: "Haro, kasih tau daily briefing"
- **Simpan**: Haro ambil data dari mem0 (mood), gbrain (jadwal), vault (notes)
- **Hasil**: "Cuaca: 28°C cerah. Jadwal: meeting jam 10, lunch jam 12. Tugas prioritas: selesain PR. Mood kemarin: 7/10"

**4. Afirmasi Pagi**
- **Akses**: Chat
- **Cara**: "Generate afirmasi pagi berdasarkan goal gw: mau lebih disiplin"
- **Simpan**: Afirmasi disimpan ke vault, bisa di-repeat besok
- **Hasil**: "1. Saya mampu mengendalikan waktu saya. 2. Setiap hari saya lebih disiplin dari kemarin. 3. Saya fokus pada prioritas hari ini."

**5. Journaling Pagi**
- **Akses**: Chat
- **Cara**: "Mau journaling pagi, kasih 3 prompt"
- **Simpan**: Jawaban disimpan ke vault `journal/2026-07-13.md`
- **Hasil**: Prompt: "1. Apa yg lo syukuri hari ini? 2. Apa tujuan utama lo hari ini? 3. Apa yg lo pengen lepaskan dari kemarin?"

**6. Sarapan Planner**
- **Akses**: Chat
- **Cara**: "Apa yg bisa gw buat sarapan dari bahan di kulkas?"
- **Simpan**: Bahan makanan dicatat di vault `pantry/stock.md`
- **Hasil**: "Dari telur, roti tawar, dan tomat: saranin scrambled egg toast. Mau resepnya?"

**7. Workout Reminder**
- **Akses**: Chat
- **Cara**: "Ingetin gw stretching jam 6 pagi setiap hari"
- **Simpan**: Jadwal di mem0, progress di vault `fitness/log.md`
- **Hasil**: Notif "Waktunya stretching 5 menit!" + "Minggu ini lo udah stretching 4/7 hari"

**8. Meditasi Guided**
- **Akses**: Voice (Ara) atau chat
- **Cara**: "Ara, guided meditation 5 menit"
- **Hasil**: Ara bacain script breathing: "Tarik napas 4 detik... tahan 4 detik... hembuskan 6 detik..."

**9. Prioritasku**
- **Akses**: Chat
- **Cara**: "Bantu urutin tugas hari ini: 1. Selesain laporan (deadline besok), 2. Belajar React (ga urgent), 3. Bayar listrik (hari ini deadline)"
- **Simpan**: Prioritas disimpan ke mem0
- **Hasil**: "1. Bayar listrik ⚡ (deadline hari ini), 2. Selesain laporan (deadline besok), 3. Belajar React (bisa nanti)"

**10. Morning Debrief**
- **Akses**: Chat
- **Cara**: "Apa yg terjadi kemarin? Ada follow-up?"
- **Simpan**: Haro query mem0 untuk aktivitas kemarin
- **Hasil**: "Kemarin lo: selesain laporan keuangan, meeting sama klien jam 2. Follow-up: kirim proposal revisi ke klien."

### Produktivitas & Kerja

**11. Meeting Notes**
- **Akses**: Voice (Ara) atau chat
- **Cara**: "Rekam meeting ini" (Ara) atau tempel transkrip meeting
- **Simpan**: `vault/meetings/2026-07-13-sprint-planning.md`
- **Hasil**: "Rangkuman: 1. Sprint goal: fitur payment gateway. 2. Deadline: 20 Juli. 3. Action items: [list]"

**12. Action Items**
- **Akses**: Chat
- **Cara**: "Ekstrak action items dari catatan meeting tadi"
- **Simpan**: Todo list di vault `tasks/2026-07-13.md`
- **Hasil**: "- [ ] Kirim proposal revisi (Budi) — deadline 14 Juli\n- [ ] Cek API docs (Ani) — deadline 15 Juli"

**13. Daily Standup**
- **Akses**: Chat
- **Cara**: "Generate standup report dari aktivitas kemarin"
- **Simpan**: Haro query mem0 + vault untuk aktivitas
- **Hasil**: "Kemarin: 1. Selesain fitur login (done). 2. Review PR Ani (done). 3. Hari ini: mulai integrasi payment. Blocker: nunggu API key dari tim backend."

**14. Email Draft**
- **Akses**: Chat
- **Cara**: "Bales email klien soal delay proyek, tone profesional tapi empati. Konteks: delay 2 minggu karena API partner"
- **Simpan**: Draft di vault `drafts/email-klien-13jul.md`
- **Hasil**: "Yth. Bapak/Ibu [Nama],\n\nDengan hormat, kami ingin menyampaikan bahwa proyek mengalami penundaan sekitar 2 minggu akibat integrasi API dari pihak ketiga. Kami sedang mengupayakan solusi terbaik dan akan memberikan update perkembangan setiap hari. Mohon maaf atas ketidaknyamanannya.\n\nHormat kami,\n[Tim]"

**15. Code Review**
- **Akses**: Chat
- **Cara**: Tempel diff atau link PR, "Review kode ini, cari bug dan security issue"
- **Simpan**: Hasil review di vault `reviews/pr-42.md`
- **Hasil**: "1. L-12: SQL injection risk — pake parameterized query. 2. L-45: Memory leak — closure di useEffect ga di-cleanup. 3. L-78: Typo variable name 'userr'."

**16. Brain Dump**
- **Akses**: Chat atau voice
- **Cara**: "Catet ide: bikin aplikasi tracker tanaman hias, pake React Native, fitur: siram reminder, foto tanaman, komunitas"
- **Simpan**: Vault `ideas/tracker-tanaman.md`
- **Hasil**: "Udah gw simpen. Mau gw organize jadi outline? Bisa juga gw tambahin ke gbrain biar nyambung sama ide2 lo sebelumnya."

**17. Research Assistant**
- **Akses**: Chat
- **Cara**: "Cari best practice microservices 2026, rangkum, simpen ke gbrain"
- **Simpan**: gbrain dengan tag `microservices`, `architecture`, `2026`
- **Hasil**: "Udah gw simpen ke gbrain. Poin utama: 1. Event-driven architecture, 2. Observability-first, 3. API versioning via gateway. Bisa di-query kapan aja."

**18. Dokumen Summarizer**
- **Akses**: Chat (upload file)
- **Cara**: Upload PDF 50 halaman, "Rangkum dalam 3 paragraf"
- **Simpan**: Ringkasan di vault `summaries/dokumen-x.md`
- **Hasil**: "Dokumen ini membahas [topik]. Poin utama: [3-5 poin]. Kesimpulan: [1 paragraf]."

**19. Meeting Notes (Voice)**
- **Akses**: Ara (voice)
- **Cara**: "Ara, mulai rekam meeting" → setelah selesai "Simpen notesnya"
- **Simpan**: Vault `meetings/2026-07-13.md`
- **Hasil**: Transkrip + rangkuman otomatis + action items

**20. Follow-up Reminder**
- **Akses**: Chat
- **Cara**: "Ingetin gw follow-up email klien jam 3 sore"
- **Simpan**: Mem0 (reminder)
- **Hasil**: Notif jam 3: "Follow-up email klien — konteks: nanyain progress proposal"

### Tengah Hari (Midday)

**21. Lunch Planner**
- **Akses**: Chat
- **Cara**: "Apa yg bisa gw masak buat lunch dari bahan: telur 3, bayam, tofu, bawang"
- **Simpan**: Resep pilihan di vault `recipes/`
- **Hasil**: "Saran: 1. Scrambled egg with spinach & tofu. 2. Miso soup with tofu. 3. Bayam tumis telur. Mau resep step-by-step?"

**22. Belanja List**
- **Akses**: Chat
- **Cara**: "Gw mau masak rendang, apa aja yg perlu dibeli?"
- **Simpan**: List belanja di vault `shopping/2026-07.md`
- **Hasil**: "Bahan rendang: 1 kg daging sapi, 2 liter santan, 5 lembar daun jeruk, 3 batang serai, 1 ruas lengkuas, cabe keriting 10 biji, bawang merah 10 siung, bawang putih 5 siung, kemiri 5 biji, kunyit, jahe, ketumbar, jinten, pala, kayu manis, gula jawa, garam."

**23. Resep Masak**
- **Akses**: Chat
- **Cara**: "Kasih resep rendang step-by-step"
- **Simpan**: Vault `recipes/rendang.md`
- **Hasil**: "1. Haluskan: bawang merah, bawang putih, cabe, kunyit, jahe, kemiri. 2. Tumis bumbu halus + serai, daun jeruk, kayu manis. 3. Masukkan daging, aduk rata. 4. Tuang santan, masak api kecil 3 jam sampai kering. 5. Bumbui garam, gula jawa."

**24. Power Nap Timer**
- **Akses**: Ara (voice)
- **Cara**: "Ara, gw mau power nap 20 menit, bangunin"
- **Hasil**: Alarm 20 menit + "Bangun! Waktunya power nap selesai. Minum air putih biar segar."

**25. Afternoon Boost**
- **Akses**: Chat
- **Cara**: "Gw ngantuk abis lunch, kasih afirmasi biar semangat lagi"
- **Hasil**: "1. Setiap napas yg gw ambil ngasih energi baru. 2. Gw punya semua yg gw butuhin untuk selesain hari ini. 3. Gw fokus dan produktif."

**26. Stretch Reminder**
- **Akses**: Chat
- **Cara**: "Ingetin gw stretching tiap 2 jam sekali"
- **Simpan**: Mem0 (reminder recurring)
- **Hasil**: Notif "Udah 2 jam duduk! Stretching 5 menit: putar leher, putar bahu, tekuk pinggang."

**27. Hydration Tracker**
- **Akses**: Chat
- **Cara**: "Catet: gw minum 1 gelas" atau "Udah berapa gelas hari ini?"
- **Simpan**: Vault `health/hydration-2026-07.md`
- **Hasil**: "Hari ini lo udah minum 3/8 gelas. Target 2 liter. Masih kurang 5 gelas."

**28. Quick Journal**
- **Akses**: Chat
- **Cara**: "Catet: hari ini gw dapet kabar baik, project disetujui klien"
- **Simpan**: Vault `journal/2026-07-13.md`
- **Hasil**: "Udah gw simpen. Mau gw kaitin ke gbrain biar nyambung sama catetan project sebelumnya?"

**30. Resep Improvisasi**
- **Akses**: Chat
- **Cara**: "Di kulkas ada: telur 2, bayam, tofu, bawang putih. Apa yg bisa gw masak?"
- **Simpan**: Vault `pantry/stock.md` diupdate
- **Hasil**: "Bisa bikin: 1. Tofu scramble with spinach — 15 menit. 2. Bayam telur kuah — 20 menit. 3. Frittata sederhana — 25 menit."

### Sore Hari (Afternoon)

**31. Post-Lunch Brain Dump**
- **Akses**: Chat atau voice
- **Cara**: "Catet ide: bikin fitur dark mode, pake context API, simpen preferensi di localStorage"
- **Simpan**: Vault `ideas/dark-mode-feature.md`
- **Hasil**: "Udah gw simpen. Mau gw tambahin ke gbrain biar nyambung sama catatan teknis lo yg lain?"

**32. Task Check-in**
- **Akses**: Chat
- **Cara**: "Apa yg udah gw selesain hari ini? Apa yg masih pending?"
- **Simpan**: Haro query mem0 + vault tasks
- **Hasil**: "Selesai: 1. Meeting pagi. 2. Review PR. Pending: 1. Kirim proposal (deadline besok). 2. Balas email klien."

**33. Energy Reset**
- **Akses**: Ara (voice)
- **Cara**: "Ara, 5 menit breathing exercise"
- **Hasil**: "Tarik napas 4 detik... tahan 4 detik... hembuskan 6 detik... (repeat 5 menit). Udah selesai! Lo pasti lebih segar sekarang."

**34. Belajar Tracker**
- **Akses**: Chat
- **Cara**: "Gw lagi belajar Python, rangkumin progress 2 minggu terakhir"
- **Simpan**: Haro query mem0 + vault `learning/python-log.md`
- **Hasil**: "Progress 2 minggu: 1. Selesai: dasar syntax, function, list comprehension. 2. Lagi: OOP (class, inheritance). 3. Total: 12/30 hari roadmap. Konsisten! 🎯"

**35. Note Organizer**
- **Akses**: Chat
- **Cara**: "Sortir catatan di vault, tag yg belum punya tag"
- **Simpan**: Vault (struktur folder + tag)
- **Hasil**: "Udah gw organize: 15 catatan → 3 folder (work, personal, learning). 5 catatan tanpa tag udah ditag otomatis berdasarkan konten."

**37. Quick Research**
- **Akses**: Chat
- **Cara**: "Cari tau perbedaan REST dan GraphQL, rangkum, simpen ke gbrain"
- **Simpan**: Gbrain dengan tag `api`, `architecture`
- **Hasil**: "Udah gw simpen ke gbrain. Poin utama: REST — multiple endpoints, over-fetching, HTTP caching. GraphQL — single endpoint, exact data, flexible query. Kapan pake REST: simple CRUD. Kapan pake GraphQL: complex data relationships."

**38. Expense Catat**
- **Akses**: Chat
- **Cara**: "Tambahin pengeluaran: gopay 25rb untuk makan siang"
- **Simpan**: Vault `finance/expenses-2026-07.md`
- **Hasil**: "Udah dicatet. Kategori: Makanan. Total pengeluaran hari ini: Rp 75.000. Sisa budget harian: Rp 25.000."

**39. Gratitude Log**
- **Akses**: Chat
- **Cara**: "Catet: gw bersyukur hari ini dapet kabar baik dari klien"
- **Simpan**: Vault `journal/gratitude-2026-07.md`
- **Hasil**: "Udah dicatet. Total gratitude log bulan ini: 12 entri. Lo udah konsisten 5 hari berturut-turut! 🎉"

**40. Ide Capture**
- **Akses**: Chat atau voice
- **Cara**: "Rekam ide: bikin aplikasi tracker tanaman hias, pake React Native, fitur: siram reminder, foto tanaman, komunitas"
- **Simpan**: Vault `ideas/tracker-tanaman.md` + gbrain
- **Hasil**: "Udah gw simpen. Ide ini nyambung sama catetan lo tentang 'side project 2026' di gbrain. Mau gw bikin outline?"

### Sore/Malam Hari

**41. Workout Log**
- **Akses**: Chat
- **Cara**: "Catet: push up 30, squat 50, lari 2km"
- **Simpan**: Vault `fitness/log-2026-07.md`
- **Hasil**: "Udah dicatet. Total minggu ini: push up 150, squat 200, lari 8km. Naik 20% dari minggu lalu! 💪"

**42. Meal Tracker**
- **Akses**: Chat
- **Cara**: "Makan siang: nasi padang, estimasi 800 kalori"
- **Simpan**: Vault `health/meals-2026-07.md`
- **Hasil**: "Udah dicatet. Total kalori hari ini: 1,200. Target: 2,000. Sisa 800 kalori buat dinner."

**43. Progress Refleksi**
- **Akses**: Chat
- **Cara**: "Apa yg gw pelajari hari ini?"
- **Simpan**: Vault `journal/learning-2026-07.md`
- **Hasil**: "Catet: hari ini lo belajar React hooks (useEffect, useMemo). Udah gw simpen. Konekin ke gbrain biar nyambung sama catetan React sebelumnya?"

**44. Brain Dump (Malam)**
- **Akses**: Chat atau voice
- **Cara**: "Tumpahin pikiran: gw khawatir soal deadline, tapi juga excited sama fitur baru. Gw juga harus inget beli kado ultah."
- **Simpan**: Vault `journal/brain-dump-2026-07-13.md`
- **Hasil**: "Udah gw catet. Gw organize: 1. Deadline — follow-up besok. 2. Fitur baru — bahas di meeting Jumat. 3. Kado ultah — ingetin H-3. Sekarang lo bisa tidur tenang."

**45. Tomorrow Prep**
- **Akses**: Chat
- **Cara**: "Siapin jadwal besok: meeting jam 10, lunch sama client jam 12, deadline laporan jam 5"
- **Simpan**: Mem0 + vault `tasks/2026-07-14.md`
- **Hasil**: "Jadwal besok: 10:00 — Meeting sprint. 12:00 — Lunch client. 17:00 — Deadline laporan. Saran: selesain laporan sebelum lunch biar ga mepet."

**46. Gratitude Journal**
- **Akses**: Chat
- **Cara**: "Tulis 3 hal yg gw syukuri hari ini"
- **Simpan**: Vault `journal/gratitude-2026-07.md`
- **Hasil**: "1. Bersyukur project disetujui klien. 2. Bersyukur bisa lunch sama keluarga. 3. Bersyukur kesehatan baik. Udah gw simpen. Streak: 12 hari berturut-turut! 🎉"

**47. Mood Tracker**
- **Akses**: Chat
- **Cara**: "Skala stress hari ini 7/10. Alasannya: deadline mepet dan kurang tidur"
- **Simpan**: Mem0 + vault `health/mood-2026-07.md`
- **Hasil**: "Udah dicatet. Pola: stress lo naik tiap hari Senin-Rabu. Saran: kurangi kopi setelah jam 3, tidur minimal 7 jam."

**48. Sleep Prep**
- **Akses**: Ara (voice)
- **Cara**: "Ara, mode tidur"
- **Hasil**: Ara matiin lampu (smart home), puter white noise, "Mode malam aktif. Matiin notif... Selesai. Selamat tidur! 😴"

**49. Dream Log**
- **Akses**: Chat
- **Cara**: "Catet mimpi: gw mimpi terbang di atas kota, trus ketemu temen lama"
- **Simpan**: Vault `journal/dreams.md`
- **Hasil**: "Udah dicatet. Mimpi terbang sering dikaitkan sama perasaan bebas atau pengen lepas dari tekanan. Mau explore lebih lanjut?"

**50. Review Hari**
- **Akses**: Chat
- **Cara**: "Review hari ini, apa yg bisa gw perbaiki besok?"
- **Simpan**: Haro query mem0 + vault
- **Hasil**: "Hari ini: 1. Selesai: 4/6 tasks. 2. Hambatan: meeting molor 1 jam. 3. Improvement: block kalender 2 jam fokus tanpa meeting. Besok: mulai dengan task prioritas #1 sebelum buka email."

### Kesehatan & Mental Wellness

**51. Cek Kecemasan**
- **Akses**: Chat
- **Cara**: "Gw lagi cemas, kasih grounding exercise"
- **Hasil**: "5-4-3-2-1 grounding: 1. Sebutin 5 hal yg lo liat. 2. Sebutin 4 hal yg lo sentuh. 3. Sebutin 3 hal yg lo denger. 4. Sebutin 2 hal yg lo cium. 5. Sebutin 1 hal yg lo rasain. Lo hebat udah mau nanganin ini. 💪"

**52. Panic Attack First Aid**
- **Akses**: Chat (urgent)
- **Cara**: "Gw panic attack, tolong"
- **Hasil**: "Lo aman. Ikutin gw: 1. Tarik napas dalam 4 detik. 2. Tahan 4 detik. 3. Hembuskan 6 detik. Ulang 5x. 4. Sekarang sebutin 5 benda yg lo liat. 5. Sebutin 4 benda yg lo sentuh. Lo baik-baik aja, ini cuma sementara."

**53. Sleep Tracker**
- **Akses**: Chat
- **Cara**: "Tidur cuma 5 jam semalem, saranin jadwal tidur"
- **Simpan**: Vault `health/sleep-2026-07.md`
- **Hasil**: "Kurang tidur bisa pengaruhin mood dan produktivitas. Saran: tidur jam 10 malam, bangun jam 5 pagi (7 jam). Hindari HP 1 jam sebelum tidur. Gw bakal ingetin lo jam 9:30 buat mulai wind down."

**54. Habit Tracker**
- **Akses**: Chat
- **Cara**: "Catet: minum vitamin ✅, baca 10 halaman ✅, meditasi 5 menit ✅"
- **Simpan**: Vault `health/habits-2026-07.md`
- **Hasil**: "Udah dicatet. Streak: vitamin 12 hari, baca 8 hari, meditasi 5 hari. Lo konsisten! 🎯"

**56. Sakit Kepala**
- **Akses**: Chat
- **Cara**: "Gw sakit kepala, cek pola seminggu terakhir"
- **Simpan**: Haro query mem0 + vault health logs
- **Hasil**: "Pola: sakit kepala muncul tiap hari Selasa-Rabu. Korelasi: kurang tidur (6 jam) dan kopi >3 gelas. Saran: kurangi kopi, minum air putih 2 liter, tidur 7 jam."

**57. Journaling Prompt**
- **Akses**: Chat
- **Cara**: "Kasih pertanyaan journaling berdasarkan mood seminggu terakhir"
- **Simpan**: Haro query mem0 untuk mood trend
- **Hasil**: "Mood lo minggu ini: cenderung cemas (6/10). Prompt: 1. Apa trigger kecemasan lo minggu ini? 2. Apa 1 hal yg lo lakuin yg bikin lo merasa lebih baik? 3. Apa yg lo butuhin minggu depan biar lebih tenang?"

**58. Screen Time Alert**
- **Akses**: Chat
- **Cara**: "Pantau screen time gw, kasih tau kalo udah 3 jam"
- **Simpan**: Mem0 (reminder recurring)
- **Hasil**: Notif "Udah 3 jam main HP! Saran: jalan kaki 5 menit, baca buku, atau ngobrol sama orang terdekat."

**59. Digital Detox**
- **Akses**: Chat
- **Cara**: "Mode fokus 2 jam, blokir notif"
- **Simpan**: Tracking di mem0
- **Hasil**: "Mode fokus aktif 2 jam. Notif dimatiin. Gw bakal tracking progress lo. Mulai sekarang... 🎯" (setelah 2 jam) "Selesai! Lo berhasil fokus 2 jam. Catet: apa yg lo capai?"

**60. Affirmation Generator**
- **Akses**: Chat
- **Cara**: "Generate afirmasi berdasarkan goal gw: mau lebih percaya diri presentasi"
- **Simpan**: Vault `affirmations/public-speaking.md`
- **Hasil**: "1. Saya punya pengetahuan yg cukup untuk presentasi ini. 2. Audiens datang untuk belajar dari saya, bukan untuk menghakimi. 3. Setiap presentasi membuat saya lebih percaya diri."

### Pekerjaan & Produktivitas

**61. Email Writer**
- **Akses**: Chat
- **Cara**: "Bales email klien soal delay proyek. Konteks: delay 2 minggu karena API partner. Tone profesional tapi empati."
- **Simpan**: Vault `drafts/email-klien-delay.md`
- **Hasil**: "Halo [Nama],\n\nTerima kasih atas konfirmasinya. Kami memahami dampak delay ini terhadap timeline Anda. Saat ini kami sedang berkoordinasi dengan pihak ketiga untuk menyelesaikan integrasi API. Target penyelesaian: 2 minggu. Kami akan memberikan update setiap hari Senin dan Kamis.\n\nMohon maaf atas ketidaknyamanannya.\n\nBest regards,\n[Tim]"

**62. Resume Tailor**
- **Akses**: Chat
- **Cara**: "Sesuaiin CV gw sama job desc ini: [tempel JD]"
- **Simpan**: Vault `career/cv-tailored-company.md`
- **Hasil**: "Udah gw tailor. Highlight yg ditambah: 1. Pengalaman microservices (sesuai JD). 2. Kata kunci: Kubernetes, Docker, CI/CD. 3. Dihilangkan: pengalaman yg ga relevan (desain grafis)."

**63. Interview Prep**
- **Akses**: Chat
- **Cara**: "Bikin daftar pertanyaan interview berdasarkan pengalaman gw: 3 tahun backend, pernah pake Go dan Python"
- **Simpan**: Vault `career/interview-prep-company.md`
- **Hasil**: "1. Ceritain tentang proyek backend terbesar yg pernah lo handle. 2. Kenapa pake Go dibanding Python? 3. Pernah nanganin high-traffic system? 4. Gimana cara lo nanganin conflict di tim?"

**64. Code Review**
- **Akses**: Chat
- **Cara**: Tempel diff: "Review kode ini, cari bug dan security issue"
- **Simpan**: Vault `reviews/pr-42.md`
- **Hasil**: "1. L-23: SQL injection — pake parameterized query. 2. L-67: Hardcoded secret — pindahin ke env var. 3. L-89: Infinite loop — useEffect missing dependency. 4. Saran: tambahin error handling di L-45."

**65. Technical Writer**
- **Akses**: Chat
- **Cara**: "Bikin dokumentasi API dari kode ini: [tempel kode]"
- **Simpan**: Vault `docs/api-documentation.md`
- **Hasil**: "# POST /api/users\nMembuat user baru.\n\n**Request:**\n```json\n{\n  \"name\": \"string (required)\",\n  \"email\": \"string (required)\",\n  \"role\": \"string (optional, default: 'user')\"\n}\n```\n\n**Response 201:**\n```json\n{\n  \"id\": \"uuid\",\n  \"name\": \"string\",\n  \"created_at\": \"timestamp\"\n}\n```"

**66. Brainstorming Partner**
- **Akses**: Chat
- **Cara**: "Gw mau bikin fitur baru: habit tracker. Temenin brainstorming"
- **Simpan**: Vault `ideas/habit-tracker-brainstorm.md`
- **Hasil**: "Oke, gw jadi devil's advocate. 1. Siapa target user? 2. Apa bedanya sama habit tracker yg udah ada? 3. Fitur wajib vs nice-to-have? 4. Monetisasi? 5. Tech stack? — Ayo jawab satu-satu, gw catet."

**67. Decision Helper**
- **Akses**: Chat
- **Cara**: "Pilih antara AWS dan GCP buat startup. Kasih pro-con berdasarkan: budget terbatas, tim kecil, butuh managed Kubernetes"
- **Simpan**: Gbrain dengan tag `infrastructure`, `decision`
- **Hasil**: "AWS: Pro — market leader, banyak tutorial. Con — pricing kompleks, gampang overbudget. GCP: Pro — simpler pricing, better managed K8s (GKE), free tier generous. Con — lebih sedikit region. Rekomendasi: GCP buat startup."

**68. Learning Path**
- **Akses**: Chat
- **Cara**: "Gw mau belajar React Native dalam 30 hari, bikin roadmap"
- **Simpan**: Vault `learning/react-native-roadmap.md`
- **Hasil**: "Minggu 1: Dasar JSX, components, props, state. Minggu 2: Navigation, API calls, FlatList. Minggu 3: AsyncStorage, camera, push notif. Minggu 4: Deploy ke Play Store/App Store. Setiap hari: 1 jam belajar + 30 menit praktek."

**69. Flashcard Generator**
- **Akses**: Chat
- **Cara**: "Bikin flashcards dari catatan kuliah di vault tentang machine learning"
- **Simpan**: Vault `learning/ml-flashcards.md`
- **Hasil**: "Flashcard: 1. Q: Apa itu supervised learning? A: Belajar dari data berlabel. 2. Q: Perbedaan overfitting vs underfitting? A: Overfitting = terlalu cocok training data, underfitting = ga cocok sama sekali. 3. Q: Apa fungsi activation function? A: Nambahin non-linearitas ke neural network."

**70. Second Brain**
- **Akses**: Chat
- **Cara**: "Cari ide yg gw tulis 3 bulan lalu tentang side project"
- **Simpan**: Haro query gbrain + vault
- **Hasil**: "Ketemu! 3 bulan lalu (14 April 2026) lo nulis: 'Side project: habit tracker dengan AI recommendation.' Detail: vault `ideas/habit-tracker.md`. Nyambung sama catetan lo minggu lalu tentang habit tracker. Mau gw rangkumin?"

### Rumah Tangga & Lifestyle

**71. Resep Harian**
- **Akses**: Chat
- **Cara**: "Di kulkas ada: ayam 500g, brokoli, wortel, telur. Apa yg bisa dimasak?"
- **Simpan**: Vault `pantry/stock.md` + `recipes/`
- **Hasil**: "1. Ayam brokoli saus tiram — 20 menit. 2. Sup ayam wortel — 30 menit. 3. Chicken stir fry — 15 menit. Mau resep lengkap?"

**72. Belanja Bulanan**
- **Akses**: Chat
- **Cara**: "Generate list belanja dari menu seminggu: Senin: ayam saus tiram, Selasa: sup, Rabu: tumis"
- **Simpan**: Vault `shopping/monthly-juli.md`
- **Hasil**: "List belanja: ayam 1kg, brokoli 2, wortel 1kg, bawang putih 1kg, saus tiram, minyak goreng, telur 1kg, beras 5kg, garam, gula."

**73. Budget Tracker**
- **Akses**: Chat
- **Cara**: "Catet pengeluaran: gopay 25rb makan siang, grab 15rb transport"
- **Simpan**: Vault `finance/expenses-2026-07.md`
- **Hasil**: "Udah dicatet. Kategori: Makanan Rp25rb, Transport Rp15rb. Total hari ini: Rp40rb. Sisa budget harian: Rp60rb. Pengeluaran terbesar bulan ini: Makanan (Rp450rb)."

**74. Tagihan Reminder**
- **Akses**: Chat
- **Cara**: "Ingetin gw bayar listrik, internet, dan BPJS tiap tanggal 20"
- **Simpan**: Mem0 (reminder recurring)
- **Hasil**: "Notif bakal muncul tiap tanggal 20: 'Bayar listrik, internet, BPJS — total estimasi Rp750rb.' Mau gw catet juga di vault?"

**75. Kesehatan Keluarga**
- **Akses**: Chat
- **Cara**: "Catet jadwal imunisasi anak: polio 15 Agustus, DPT 20 September"
- **Simpan**: Vault `family/health-schedule.md` + reminder di mem0
- **Hasil**: "Udah dicatet. Gw bakal ingetin lo H-3: 'Imunisasi polio Ananda: 3 hari lagi!'"

**76. Pekerjaan Rumah**
- **Akses**: Chat
- **Cara**: "Bagi tugas bersihin rumah buat 4 orang: A, B, C, D"
- **Simpan**: Vault `family/chores-weekly.md`
- **Hasil**: "Senin: A=sapu, B=pel, C=cuci piring, D=beresin kamar. Selasa: A=cuci baju, B=setrika, C=sapu, D=pel. (rotasi tiap minggu)"

**77. Tanaman Hias**
- **Akses**: Chat
- **Cara**: "Kasih tau jadwal siram tanaman: monstera (2x seminggu), kaktus (1x 2 minggu), sirih gading (3x seminggu)"
- **Simpan**: Vault `plants/schedule.md` + reminder di mem0
- **Hasil**: "Jadwal: Senin — monstera, sirih. Rabu — monstera, sirih. Jumat — monstera, sirih. Minggu — kaktus. Gw bakal ingetin lo tiap hari."

**78. Resep Favorit**
- **Akses**: Chat
- **Cara**: "Simpen resep rendang turun-temurun: [tempel resep]"
- **Simpan**: Vault `recipes/rendang-pusaka.md`
- **Hasil**: "Udah gw simpen dengan tag: #resep #rendang #pusaka. Mau gw tambahin foto? Bisa juga lo akses kapan aja: 'Haro, kasih resep rendang'"

**79. Kulkas Tracker**
- **Akses**: Chat
- **Cara**: "Catet stok: telur 12, susu 1L, bayam 1 ikat, tahu 5"
- **Simpan**: Vault `pantry/stock.md`
- **Hasil**: "Udah dicatet. Telur: 12 (exp 20 Juli). Susu: 1L (exp 16 Juli). Bayam: 1 ikat (exp 15 Juli). Tahu: 5 (exp 14 Juli). Gw bakal ingetin kalo ada yg mau expired."

**80. Liburan Planner**
- **Akses**: Chat
- **Cara**: "Bikin itinerary 3 hari ke Jogja: budget Rp3jt, suka kuliner dan alam"
- **Simpan**: Gbrain + vault `travel/jogja-itinerary.md`
- **Hasil**: "Hari 1: Tiba pagi → breakfast angkringan → Keraton → Taman Sari → malam: Malioboro. Hari 2: Sunrise Merapi → Kaliurang → lunch lesehan → Goa Jomblang. Hari 3: Borobudur sunrise → Pantai Parangtritis → balik. Estimasi budget: transport Rp800rb, hotel Rp600rb, makan Rp500rb, tiket Rp300rb, lain2 Rp300rb = Rp2.5jt."

### Keuangan & Hukum

**81. Budget Bulanan**
- **Akses**: Chat
- **Cara**: "Tracking pengeluaran bulan ini, kasih tau kalo udah overspend"
- **Simpan**: Vault `finance/budget-juli.md`
- **Hasil**: "Pengeluaran Juli: Makanan Rp1.2jt (limit Rp1jt ❌), Transport Rp400rb (limit Rp500rb ✅), Hiburan Rp600rb (limit Rp500rb ❌), Belanja Rp300rb (limit Rp1jt ✅). Total: Rp2.5jt dari budget Rp3jt. Sisa: Rp500rb. Overspend: Makanan dan Hiburan."

**82. Investasi Tracker**
- **Akses**: Chat
- **Cara**: "Catet portofolio: BTC 0.1 @ 800jt, ETH 2 @ 50jt, saham BBCA 100 @ 10rb"
- **Simpan**: Vault `finance/portfolio.md`
- **Hasil**: "Udah dicatet. Total investasi: Rp110jt. Performa: BTC +12%, ETH -5%, BBCA +3%. Rekap mingguan bakal gw kirim tiap hari Minggu."

**84. Pajak Prep**
- **Akses**: Chat
- **Cara**: "Kumpulin bukti potong dan pengeluaran buat SPT tahunan"
- **Simpan**: Vault `finance/tax-2026/`
- **Hasil**: "Buat folder: 1. Bukti potong (1721-A1). 2. Pengeluaran (kesehatan, pendidikan, donasi). 3. Aset (rumah, kendaraan). Upload dokumen ke vault, nanti gw generate ringkasan buat SPT."

**86. Kontrak Review**
- **Akses**: Chat
- **Cara**: Upload file kontrak: "Highlight poin penting dari kontrak kerja ini"
- **Simpan**: Vault `legal/kontrak-kerja-2026.md`
- **Hasil**: "Poin penting: 1. Masa kontrak: 1 tahun (1 Jan - 31 Des 2026). 2. Gaji: Rp15jt/bulan. 3. Notice period: 30 hari. 4. Non-compete clause: 6 bulan setelah resign. ⚠️ Perhatikan: klausul non-compete cukup ketat — konsultasi ke legal."

**87. Budget Planner**
- **Akses**: Chat
- **Cara**: "Bikin budget bulan depan berdasarkan pengeluaran 3 bulan terakhir"
- **Simpan**: Vault `finance/budget-agustus.md`
- **Hasil**: "Rata-rata pengeluaran 3 bulan: Makanan Rp1.2jt, Transport Rp400rb, Hiburan Rp500rb, Belanja Rp600rb, Tagihan Rp800rb. Saran budget Agustus: Makanan Rp1.1jt (irit 10%), Transport Rp400rb, Hiburan Rp400rb, Belanja Rp500rb, Tagihan Rp800rb. Total: Rp3.2jt."

**88. Wishlist Tracker**
- **Akses**: Chat
- **Cara**: "Catet wishlist: MacBook Pro Rp30jt (priority: high), Kindle Rp2jt (medium), Headphone Rp1.5jt (low)"
- **Simpan**: Vault `finance/wishlist.md`
- **Hasil**: "Udah dicatet. Prioritas: 1. MacBook Pro (high) — butuh 10 bulan nabung Rp3jt/bulan. 2. Kindle (medium) — 1 bulan. 3. Headphone (low) — 3 minggu. Mau gw bikin rencana nabung?"

**89. Cicilan Monitor**
- **Akses**: Chat
- **Cara**: "Tracking cicilan: KPR sisa 120jt (5 tahun), motor sisa 15jt (1 tahun), kartu kredit 5jt"
- **Simpan**: Vault `finance/debts.md`
- **Hasil**: "Total cicilan: Rp140jt. KPR: Rp2jt/bulan (lunas 2031). Motor: Rp1.25jt/bulan (lunas 2027). Kartu kredit: Rp5jt (lunas bulan depan). Saran: lunasin kartu kredit dulu (bunga tertinggi)."

**90. Darurat Dana**
- **Akses**: Chat
- **Cara**: "Simulasi dana darurat: pengeluaran bulanan gw Rp5jt"
- **Simpan**: Vault `finance/emergency-fund.md`
- **Hasil**: "Dana darurat ideal: 6 bulan × Rp5jt = Rp30jt. Saat ini: Rp10jt (33% dari target). Target: nabung Rp2jt/bulan → tercapai 10 bulan lagi. Mau gw bikin rencana nabung?"

### Sosial & Relasi

**91. Birthday Reminder**
- **Akses**: Chat
- **Cara**: "Catet ultah: Budi 17 Juli, Ani 25 Agustus, Sari 3 September"
- **Simpan**: Mem0 (reminder) + vault `social/birthdays.md`
- **Hasil**: "Udah dicatet. Gw bakal ingetin lo H-3: 'Ultah Budi 3 hari lagi! Saran kado: [based on hobi Budi]'"

**92. Chat Draft**
- **Akses**: Chat
- **Cara**: "Bales chat WA yg belum dibales dari klien: 'Halo, gimana progress projectnya?' Tone santai tapi profesional"
- **Simpan**: Vault `drafts/chat-client.md`
- **Hasil**: "Halo [Nama], maaf baru balas. Progress project udah 70%, tinggal integrasi payment. Target selesai sesuai jadwal. Mau gw kirimin update detail?"

**93. Argumen Refleksi**
- **Akses**: Chat
- **Cara**: "Gw abis debat sama pasangan soal masalah keuangan. Bantu liat dari sisi lain"
- **Simpan**: Vault `journal/reflection-argumen.md`
- **Hasil**: "Coba liat dari sisi pasangan lo: 1. Mungkin dia merasa ga dilibatkan dalam keputusan keuangan. 2. Mungkin dia khawatir soal masa depan. 3. Mungkin cara lo menyampaikan terdengar menghakimi. Saran: besok ajak ngobrol pelan-pelan, mulai dari 'Gw pengen ngerti perasaan lo soal kemarin'."

**94. Gift Ideas**
- **Akses**: Chat
- **Cara**: "Kasih ide kado ultah buat bestie: hobi fotografi, budget max Rp500rb"
- **Simpan**: Vault `social/gift-ideas.md`
- **Hasil**: "1. Tripod mini Rp150rb. 2. Buku 'Understanding Exposure' Rp200rb. 3. Lens cleaning kit Rp100rb. 4. Polaroid camera Rp400rb. 5. Voucher editing software Rp300rb. Rekomendasi: tripod + buku — total Rp350rb."

**95. Travel Journal**
- **Akses**: Chat
- **Cara**: "Catet perjalanan hari ini: ke Pantai Parangtritis, sunset bagus banget, makan ikan bakar"
- **Simpan**: Vault `travel/jogja-2026/day-1.md` + foto
- **Hasil**: "Udah dicatet. Mau upload foto? Bisa juga gw tambahin lokasi ke gbrain biar lo bisa search nanti: 'cari liburan pantai'."

**96. Party Planner**
- **Akses**: Chat
- **Cara**: "Bikin list BBQ akhir pekan: 10 orang, budget Rp1jt"
- **Simpan**: Vault `events/bbq-juli.md`
- **Hasil**: "Menu: sate ayam 50 tusuk, sapi 30 tusuk, jagung 10, kentang, saus. Minuman: es teh, jus. Budget: daging Rp400rb, bumbu Rp100rb, arang Rp50rb, minuman Rp100rb, snack Rp100rb, dekor Rp50rb, cadangan Rp200rb. Total Rp1jt ✅. Mau gw bikin list belanja?"

**97. Networking Tracker**
- **Akses**: Chat
- **Cara**: "Catet: ketemu Budi (CTO StartupX) di event TechMeetup. Bahas: potensi kolaborasi AI. Follow-up: kirim proposal minggu depan"
- **Simpan**: Vault `network/contacts.md` + gbrain
- **Hasil**: "Udah dicatet. Gw bakal ingetin lo Jumat: 'Follow-up Budi (CTO StartupX) — kirim proposal kolaborasi AI.'"

**98. Volunteer Log**
- **Akses**: Chat
- **Cara**: "Tracking jam sosial: ngajar coding 2 jam, bersih pantai 3 jam"
- **Simpan**: Vault `volunteer/log-2026.md`
- **Hasil**: "Udah dicatet. Total: 5 jam. Bulan ini: 12 jam. Target: 20 jam/bulan. Sisa: 8 jam. Mau generate laporan buat sertifikat?"

**99. Community Event**
- **Akses**: Chat
- **Cara**: "Cari event weekend yg sesuai minat: tech, AI, musik"
- **Simpan**: Gbrain
- **Hasil**: "Weekend ini: 1. Sabtu: AI Meetup (Jakarta) — 09:00-12:00. 2. Sabtu: Tech Startup Gathering (online) — 14:00. 3. Minggu: Sunday Jazz (Bandung) — 10:00. Udah gw simpen ke gbrain. Mau gw daftarin?"

**100. Daily Gratitude Broadcast**
- **Akses**: Chat
- **Cara**: "Generate 3 hal baik hari ini buat dikirim ke grup keluarga"
- **Simpan**: Vault `journal/gratitude-broadcast.md`
- **Hasil**: "1. Hari ini project gw disetujui klien — lega banget! 2. Dapet resep baru dari temen, enak banget. 3. Cuaca cerah, bisa jalan sore. — Udah siap. Mau gw kirim ke grup?"
- `apps/haro-voice/` — [Ara voice assistant](apps/haro-voice/README.md)
- `apps/memory-fabric/` — [Memory Fabric MCP server](apps/memory-fabric/README.md)
- `apps/haro-gateway/` — [AI gateway](apps/haro-gateway/README.md)
- `apps/mcp/` — [OKF MCP server](apps/mcp/README.md)
- `packages/core/` — [UI component library](packages/core/README.md)
- `packages/ts-config/` — [Shared TS configs](packages/ts-config/README.md)

## License

MIT — see [LICENSE.md](LICENSE.md).
