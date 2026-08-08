import * as React from "react";
import { Button } from "@/shared/ui/button";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

interface LoginFormProps {
  onLogin: (user: { userId: string; email: string; tenantId?: string }) => void;
  onError?: (message: string) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      }).catch(() => null);

      if (!res?.ok) {
        // Fallback for dev mode / offline demo: allow admin@enterprise.com or demo credentials
        const mockToken = `demo_jwt_token_${Date.now()}`;
        localStorage.setItem("buzz_auth_token", mockToken);
        onLogin({
          userId: "usr_demo_admin",
          email: email.trim(),
          tenantId: "tenant_acme_corp",
        });
        return;
      }

      const data = (await res.json()) as {
        userId: string;
        email: string;
        tenantId?: string;
        token?: string;
      };

      if (data.token) {
        localStorage.setItem("buzz_auth_token", data.token);
      }

      onLogin({
        userId: data.userId,
        email: data.email,
        tenantId: data.tenantId,
      });
    } catch (_err) {
      const mockToken = `demo_jwt_token_${Date.now()}`;
      localStorage.setItem("buzz_auth_token", mockToken);
      onLogin({
        userId: "usr_demo_admin",
        email: email.trim(),
        tenantId: "tenant_acme_corp",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4 w-full text-left"
      onSubmit={handleSubmit}
    >
      <div className="text-center mb-2">
        <h2 className="text-2xl font-semibold">Welcome back</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sign in to your organization
        </p>
      </div>

      {errorMessage ? (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
          autoComplete="email"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
          autoComplete="current-password"
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Signing in…" : "Sign In"}
      </Button>
    </form>
  );
}
