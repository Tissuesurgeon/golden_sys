"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { SchoolLogo } from "@/components/brand/school-logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { signInAction } from "@/lib/server/actions";

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter the email address and password.");
      return;
    }
    setLoading(true);
    const result = await signInAction(email, password);
    if (result.error) {
      setLoading(false);
      setError(result.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1fr)]">
      <section className="flex flex-col justify-between border-border bg-white px-6 py-8 sm:px-10 lg:border-r lg:px-14 lg:py-12">
        <SchoolLogo size={168} priority className="mx-auto lg:mx-0" />
        <div className="mx-auto mt-8 max-w-md lg:mx-0">
          <h1 className="text-[28px] font-semibold tracking-tight text-navy sm:text-[32px]">Golden Child School</h1>
          <div className="mt-4 h-px w-12 bg-gold" />
          <p className="mt-4 text-sm font-medium text-navy">Knowledge is power</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            Student records, school fees, and report cards for the Koforidua campus. One school, kept in one place.
          </p>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">Koforidua, Ghana</p>
      </section>

      <section className="flex items-center bg-background px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <h2 className="text-[26px] font-semibold text-navy">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign in with your school account.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium text-ink">Email</span>
              <Input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(error)}
                placeholder="name@goldenchild.example"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium text-ink">Password</span>
              <span className="relative block">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(error)}
                  className="pr-11"
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>
            <div className="flex justify-end">
              <button type="button" className="text-sm font-medium text-blue hover:text-blue-hover" onClick={() => setForgotOpen(true)}>
                Forgot password
              </button>
            </div>
            {error ? (
              <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full bg-primary hover:bg-blue-hover" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {loading ? "Signing in" : "Sign in"}
            </Button>
          </form>
        </div>
      </section>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ask the school administrator</DialogTitle>
            <DialogDescription>
              Password reset links are issued by an administrator. They appear in Users and Permissions until email delivery is configured.
            </DialogDescription>
          </DialogHeader>
          <Button type="button" onClick={() => setForgotOpen(false)}>
            Back to sign in
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
