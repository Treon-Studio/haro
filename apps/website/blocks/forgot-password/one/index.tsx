"use client"

import { useState, useCallback } from "react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@treonstudio/bungas-core/ui/label"
import { ROUTES } from "@/shared/constants/api.constants"

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await fetch(ROUTES.API.AUTH.FORGOT_PASSWORD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
    } finally {
      setIsLoading(false)
      setSent(true)
    }
  }, [email])

  if (sent) {
    return (
      <section className="bg-background flex grid min-h-screen grid-rows-[auto_1fr] px-4">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <Logo />
        </header>
        <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center text-center">
          <h1 className="font-serif text-4xl font-medium">Check your email</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Jika email terdaftar, kami telah mengirim tautan reset password.
          </p>
          <a href="/login" className="text-primary mt-4 inline-block font-medium hover:underline">
            Back to Login
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
            <h1 className="font-serif text-4xl font-medium">Forgot password?</h1>
            <p className="text-muted-foreground text-sm">Enter your email and we'll send you a reset link</p>
          </div>
        </div>
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
              />
            </div>
            <Button className="w-full" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <a href="/login" className="text-primary font-medium hover:underline">
              Back to Login
            </a>
          </div>
        </Card>
      </div>
    </section>
  )
}
