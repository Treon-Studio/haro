'use client'

import { useEffect, useState } from 'react'

export default function OAuthError() {
  const [errorType, setErrorType] = useState<string>('unknown_error')

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    setErrorType(searchParams.get('error') || 'unknown_error')
  }, [])

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'missing_code':
        return 'Authorization code is missing. Please try again.'
      case 'provider_unavailable':
        return 'Authentication provider is unavailable. Please try again.'
      default:
        return error.replace(/_/g, ' ')
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-8">
      <div className="border-border w-full max-w-md rounded-xl border p-8 text-center shadow-lg">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg className="h-6 w-6 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>
        <h1 className="text-foreground mb-4 text-3xl font-bold">Authentication Failed</h1>
        <p className="text-muted-foreground mb-6 text-sm">{getErrorMessage(errorType)}</p>
        <button
          onClick={() => { window.location.href = '/login' }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-4 py-2 text-sm font-medium transition-colors"
          aria-label="Back to Login"
        >
          Back to Login
        </button>
      </div>
    </div>
  )
}
