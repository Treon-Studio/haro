'use client'

import { useEffect, useState } from 'react'

export default function OAuthSuccess() {
  const [secondsLeft, setSecondsLeft] = useState(3)

  useEffect(() => {
    const countdown = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdown)
          window.location.href = '/c/new'
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(countdown)
  }, [])

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-8">
      <div className="border-border w-full max-w-md rounded-xl border p-8 text-center shadow-lg">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-6 w-6 text-green-600 dark:text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h1 className="text-foreground mb-4 text-3xl font-bold">Authentication Successful</h1>
        <p className="text-muted-foreground mb-2 text-sm">
          Redirecting to dashboard in{' '}
          <span className="text-primary font-medium">{secondsLeft}</span>{' '}
          seconds.
        </p>
      </div>
    </div>
  )
}
