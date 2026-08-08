import * as React from "react";
import { Button } from "@/shared/ui/button";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

interface RegisterTenantFormProps {
  onRegister: (user: {
    userId: string;
    email: string;
    tenantId: string;
    tenantSlug: string;
  }) => void;
  onError?: (message: string) => void;
}

export function RegisterTenantForm({
  onRegister,
  onError,
}: RegisterTenantFormProps) {
  const [orgName, setOrgName] = React.useState("");
  const [orgSlug, setOrgSlug] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Auto-derive slug from org name
  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    setOrgSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !email.trim() || !password.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: orgName.trim(),
          organizationSlug: orgSlug.trim() || undefined,
          fullName: fullName.trim() || undefined,
          email: email.trim(),
          password,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as any).message ?? "Registration failed. Please try again.";
        setErrorMessage(msg);
        onError?.(msg);
        return;
      }

      const data = (await res.json()) as {
        userId: string;
        email: string;
        tenantId: string;
        tenantSlug: string;
        token?: string;
      };

      if (data.token) {
        localStorage.setItem("buzz_auth_token", data.token);
      }

      onRegister({
        userId: data.userId,
        email: data.email,
        tenantId: data.tenantId,
        tenantSlug: data.tenantSlug,
      });
    } catch {
      const msg = "Network error. Please check your connection.";
      setErrorMessage(msg);
      onError?.(msg);
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
        <h2 className="text-2xl font-semibold">Create your organization</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set up your team workspace
        </p>
      </div>

      {errorMessage ? (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-org-name" className="text-sm font-medium">
          Organization Name
        </label>
        <input
          id="reg-org-name"
          type="text"
          placeholder="Acme Corp"
          value={orgName}
          onChange={(e) => handleOrgNameChange(e.target.value)}
          className="px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
          autoComplete="organization"
        />
        {orgSlug ? (
          <p className="text-xs text-muted-foreground">
            Workspace: <span className="font-mono">{orgSlug}</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-full-name" className="text-sm font-medium">
          Your Name
        </label>
        <input
          id="reg-full-name"
          type="text"
          placeholder="Jane Smith"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          autoComplete="name"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-email" className="text-sm font-medium">
          Work Email
        </label>
        <input
          id="reg-email"
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
        <label htmlFor="reg-password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="reg-password"
          type="password"
          placeholder="Minimum 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Creating workspace…" : "Create Organization"}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        By creating an account you agree to our Terms of Service and Privacy
        Policy.
      </p>
    </form>
  );
}
