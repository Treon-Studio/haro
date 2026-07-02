"use client"

import { useState, useEffect, useCallback } from "react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@treonstudio/bungas-core/ui/label"
import { Badge } from "@treonstudio/bungas-core/ui/badge"
import { ROUTES } from "@/shared/constants/api.constants"
import { cn } from "@treonstudio/bungas-core/lib/utils"
import { ShieldWarningLinear, RefreshCircleLinear, CheckCircleLinear, ArrowRightLinear } from 'solar-icon-set';

export default function SignUp() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // B2B Onboarding states
  const [invitationToken, setInvitationToken] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  // On mount: check for invitation token in query
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const token = params.get("invitation")
    
    if (token) {
      setInvitationToken(token)
      setIsVerifying(true)
      setError(null)

      fetch("/api/invitations/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success && result.data) {
            setEmail(result.data.email) // Prefill email
            setCompanyName(result.data.company_name || "Organisasi Anda")
          } else {
            setError(result.error?.message || "Undangan tidak valid atau sudah kedaluwarsa")
          }
        })
        .catch(() => setError("Gagal menghubungi server untuk memverifikasi undangan"))
        .finally(() => setIsVerifying(false))
    }
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(ROUTES.API.AUTH.SIGNUP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          invitationToken: invitationToken || undefined,
        }),
      })
      const result = await res.json()

      if (!result.success) {
        setError(result.error.message)
        return
      }

      setSuccess(true)
    } catch {
      setError("Gagal menghubungi server. Coba lagi.")
    } finally {
      setIsLoading(false)
    }
  }, [email, password, invitationToken])

  if (isVerifying) {
    return (
      <section className="bg-background flex grid min-h-screen grid-rows-[auto_1fr] px-4">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <Logo />
        </header>
        <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center text-center">
          <RefreshCircleLinear className="h-10 w-10 text-brand-primary animate-spin" />
          <h2 className="mt-4 font-bold">Memverifikasi Undangan...</h2>
          <p className="text-xs text-text-secondary mt-1">Harap tunggu sementara sistem memeriksa tautan B2B Anda.</p>
        </div>
      </section>
    )
  }

  if (success) {
    return (
      <section className="bg-background flex grid min-h-screen grid-rows-[auto_1fr] px-4">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <Logo />
        </header>
        <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center text-center space-y-6">
          <div className="h-14 w-14 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
            <CheckCircleLinear className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="font-serif text-4xl font-medium">Registrasi Berhasil!</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Kami telah mengirimkan tautan verifikasi email ke <strong>{email}</strong>. 
              {companyName ? ` Silakan verifikasi email Anda untuk bergabung dengan ${companyName} di Haro.` : " Silakan verifikasi email Anda untuk mulai berkonsultasi."}
            </p>
          </div>
          <a
            href={ROUTES.PAGE.LOGIN}
            className="flex items-center gap-1.5 text-sm text-brand-primary font-bold hover:underline pt-2"
          >
            Menuju Halaman Login
            <ArrowRightLinear className="h-4 w-4" />
          </a>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-background flex grid min-h-screen grid-rows-[auto_1fr] px-4 py-6">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <Logo />
      </header>
      <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-4">
          <span className="text-muted-foreground text-sm font-normal tracking-widest uppercase">
            {companyName ? "B2B COORPORATE ONBOARDING" : "CREATE YOUR ACCOUNT"}
          </span>
          <div className="space-y-1 text-center">
            <h1 className="font-serif text-4xl font-medium">Get started</h1>
            {companyName ? (
              <p className="text-muted-foreground text-sm">
                Selamat bergabung! Anda diundang oleh <strong className="text-brand-primary font-bold">{companyName}</strong> ke Haro.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">Create your account to get started</p>
            )}
          </div>
        </div>

        {/* B2B Onboarding Welcome Notice Banner */}
        {companyName && (
          <div className="flex items-start gap-2.5 p-4 rounded-lg bg-brand-primary/5 border border-brand-primary/10 text-xs leading-relaxed text-text-primary">
            <CheckCircleLinear className="h-5 w-5 shrink-0 text-brand-primary mt-0.5" />
            <div>
              <span className="font-bold block">Aktivasi Tenant Sukses</span>
              Sistem telah mendeteksi email Anda terdaftar di roster perusahaan. Form pendaftaran telah dikunci pada email Anda demi keamanan.
            </div>
          </div>
        )}

        <Card className="w-full p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="hello@tenang.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!!invitationToken} // LockLinear email input in B2B invitation mode
                className={cn(invitationToken && "bg-surface-secondary text-text-secondary cursor-not-allowed")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <div className="text-sm text-red-500">{error}</div>}
            <Button className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          {/* B2B Privacy Reassurance Notice */}
          {companyName && (
            <div className="flex items-start gap-2 p-3 mt-4 rounded-lg bg-surface-secondary/50 border border-border-primary/50 text-[10px] leading-relaxed text-text-secondary">
              <ShieldWarningLinear className="h-4 w-4 shrink-0 text-brand-primary mt-0.5" />
              <div>
                <strong className="text-text-primary">Kebijakan Privasi</strong>: Obrolan chat, refleksi harian, dan data konsultasi Anda sepenuhnya privat. Perusahaan Anda (<span className="font-bold text-text-primary">{companyName}</span>) tidak dapat melihat percakapan atau mengidentifikasi data individual Anda.
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account?</span>{" "}
            <a href={ROUTES.PAGE.LOGIN} className="text-primary font-medium hover:underline">
              Sign in
            </a>
          </div>
        </Card>
      </div>
    </section>
  )
}
