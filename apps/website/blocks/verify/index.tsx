"use client"

import React, { useState, useEffect } from "react"
import { Logo } from "@/components/logo"
import { ROUTES } from "@/shared/constants/api.constants"

export default function VerifyEmail() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const email = params.get("email") ?? ""
    const token = params.get("token") ?? params.get("token_hash") ?? ""

    if (!email || !token) {
      setStatus("error")
      setErrorMsg("Link verifikasi tidak valid.")
      return
    }

    const verify = async () => {
      try {
        const res = await fetch(ROUTES.API.AUTH.VERIFY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token, type: "signup" }),
        })
        const result = await res.json()

        if (result.success) {
          setStatus("success")
        } else {
          setStatus("error")
          setErrorMsg(result.error.message)
        }
      } catch {
        setStatus("error")
        setErrorMsg("Gagal memverifikasi email. Coba lagi.")
      }
    }

    verify()
  }, [])

  return (
    <section className="bg-background flex grid min-h-screen grid-rows-[auto_1fr] px-4">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <Logo />
      </header>
      <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center text-center">
        {status === "verifying" && (
          <>
            <h1 className="font-serif text-4xl font-medium">Verifying...</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Please wait while we verify your email.
            </p>
          </>
        )}
        {status === "success" && (
          <>
            <h1 className="font-serif text-4xl font-medium">Email verified</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Your email has been verified successfully.
            </p>
            <a href="/login" className="text-primary mt-4 inline-block font-medium hover:underline">
              Sign in
            </a>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="font-serif text-4xl font-medium">Verification failed</h1>
            <p className="text-muted-foreground mt-2 text-sm">{errorMsg}</p>
            <a href="/sign-up" className="text-primary mt-4 inline-block font-medium hover:underline">
              Sign up again
            </a>
          </>
        )}
      </div>
    </section>
  )
}
