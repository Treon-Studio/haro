"use client"

import React, { useState, useCallback, useEffect } from "react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@treonstudio/bungas-core/ui/label"
import { ROUTES } from "@/shared/constants/api.constants"

export default function TwoFactorScreen() {
  const [email, setEmail] = useState("")
  const [token, setToken] = useState("")
  const [backupCode, setBackupCode] = useState("")
  const [useBackup, setUseBackup] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setEmail(params.get("email") ?? "")
  }, [])

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")

    const code = useBackup ? backupCode : token
    if (code.length < (useBackup ? 8 : 6)) {
      setErrorMsg(`Masukkan kode ${useBackup ? "8" : "6"} digit`)
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch(ROUTES.API.AUTH.TWO_FACTOR, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: code, type: "2fa" }),
      })
      const result = await res.json()

      if (result.success) {
        window.location.href = ROUTES.PAGE.DASHBOARD
      } else {
        setErrorMsg(result.error.message)
      }
    } catch {
      setErrorMsg("Gagal menghubungi server")
    } finally {
      setIsLoading(false)
    }
  }, [email, token, backupCode, useBackup])

  return (
    <section className="bg-background flex grid min-h-screen grid-rows-[auto_1fr] px-4">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <Logo />
      </header>
      <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-4">
          <span className="text-muted-foreground text-sm font-normal tracking-widest uppercase">
            TWO-FACTOR AUTHENTICATION
          </span>
          <div className="space-y-1 text-center">
            <h1 className="font-serif text-4xl font-medium">Enter verification code</h1>
            <p className="text-muted-foreground text-sm">
              Masukkan kode 6 digit dari aplikasi authenticator Anda
            </p>
          </div>
        </div>
        <Card className="w-full p-8">
          <form onSubmit={onSubmit} className="space-y-5">
            {useBackup ? (
              <div className="space-y-2">
                <Label htmlFor="backupCode">Backup code</Label>
                <Input
                  id="backupCode"
                  type="text"
                  placeholder="Enter 8-digit backup code"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="token">Verification code</Label>
                <Input
                  id="token"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
              </div>
            )}
            {errorMsg && <div className="text-sm text-red-500">{errorMsg}</div>}
            <Button className="w-full" disabled={isLoading}>
              {isLoading ? "Verifying..." : "Verify"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => { setUseBackup(!useBackup); setErrorMsg("") }}
              className="text-primary font-medium hover:underline"
            >
              {useBackup ? "Use authenticator code" : "Use backup code"}
            </button>
          </div>
        </Card>
      </div>
    </section>
  )
}
