import type { APIRoute } from "astro"
import { query } from "@/lib/neon/client"
import { hashPassword } from "@/lib/auth/session"

const SEED_USERS = [
  { email: "superadmin@tenang.ai", password: "Admin123!", full_name: "Super Admin" },
  { email: "admin@corp.tenang.ai", password: "Admin123!", full_name: "Budi Santoso" },
  { email: "employee1@corp.tenang.ai", password: "User123!", full_name: "Siti Rahmawati" },
  { email: "employee2@corp.tenang.ai", password: "User123!", full_name: "Ahmad Fauzi" },
  { email: "terapis@tenang.ai", password: "Terapis123!", full_name: "Dr. Maya Wijaya" },
]

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${import.meta.env.SEED_SECRET || "dev-seed-secret"}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })
  }

  const results: unknown[] = []

  for (const u of SEED_USERS) {
    try {
      const existing = await query("SELECT id FROM auth.users WHERE email = $1", [u.email])
      if (existing.rowCount && existing.rowCount > 0) {
        results.push({ email: u.email, status: "exists" })
        continue
      }

      const hashed = await hashPassword(u.password)
      const res = await query(
        `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
         VALUES ($1, $2, NOW(), $3, $4)
         RETURNING id`,
        [
          u.email,
          hashed,
          JSON.stringify({ provider: "email", providers: ["email"] }),
          JSON.stringify({ full_name: u.full_name }),
        ],
      )

      const user = res.rows[0]
      if (!user) {
        results.push({ email: u.email, status: "error", error: "Failed to insert user" })
      } else {
        results.push({ email: u.email, status: "created", id: user.id })
      }
    } catch (error: any) {
      results.push({ email: u.email, status: "error", error: error.message })
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "content-type": "application/json" },
  })
}
