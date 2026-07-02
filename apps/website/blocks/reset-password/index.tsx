"use client"

import React, { useState, useEffect } from "react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@treonstudio/bungas-core/ui/label"
import { ROUTES } from "@/shared/constants/api.constants"

export default function ResetPassword() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [tokenHash, setTokenHash] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setTokenHash(params.get("token_hash") ?? params.get("code") ?? "")
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(ROUTES.API.AUTH.RESET_PASSWORD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, tokenHash }),
      })
      const result = await res.json()

      if (!result.success) {
        setError(result.error.message)
        return
      }

      setSubmitted(true)
    } catch {
      setError("Gagal menghubungi server")
    } finally {
      setIsLoading(false)
    }
  }

  if (submitted) {
    return (
      <section className="bg-background flex grid min-h-screen grid-rows-[auto_1fr] px-4">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <Logo />
        </header>
        <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center text-center">
          <h1 className="font-serif text-4xl font-medium">Password updated</h1>
          <p className="text-muted-foreground mt-2 text-sm">Your password has been reset successfully.</p>
          <a href="/login" className="text-primary mt-4 inline-block font-medium hover:underline">
            Sign in
          </a>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-background flex grid min-h-screen grid-rows-[auto_1fr] px-4">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <Logo />
      </header>
      <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-4">
          <span className="text-muted-foreground text-sm font-normal tracking-widest uppercase">
            RESET PASSWORD
          </span>
          <div className="space-y-1 text-center">
            <h1 className="font-serif text-4xl font-medium">Enter new password</h1>
            <p className="text-muted-foreground text-sm">Choose a new password for your account</p>
          </div>
        </div>
        <Card className="w-full p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {error && <div className="text-sm text-red-500">{error}</div>}
            <Button className="w-full" disabled={isLoading}>
              {isLoading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </Card>
      </div>
    </section>
  )
}
