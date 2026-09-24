import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="mb-5">
          <div className="mb-3 flex size-8 items-center justify-center rounded-md bg-brand text-[11px] font-semibold text-primary-foreground">
            CRM
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Access your Aurora CRM workspace.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
