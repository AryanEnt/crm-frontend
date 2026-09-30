"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, LockKeyhole, Mail } from "lucide-react";
import { Form, PasswordField, TextField, useZodForm } from "@/components/forms";
import { Button } from "@/components/ui/console/button";
import { useAuth } from "@/features/auth/auth-provider";
import { copy } from "@/lib/copy";
import { canAccessPath } from "@/lib/permissions";
import { ApiError } from "@/types/api";
import { loginSchema, type LoginValues } from "@/validations/auth";

/** Label + 44px control + one message line, so inline errors never move the fields below. */
const FIELD_SLOT = "min-h-22";

/** Both fields are always required here, so the required marker is hidden. */
const FIELDS =
  "flex flex-col gap-2 [&_input]:h-11 [&_input]:rounded-xl [&_input]:bg-surface [&_input]:pl-9 [&_label>span]:hidden";

const UNREACHABLE = new Set([0, 502, 503, 504]);

function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (UNREACHABLE.has(error.status)) return copy.error.network;
    if (error.status === 401 && /deactivated/i.test(error.message)) {
      return "This account is deactivated. Ask your workspace admin to reactivate it.";
    }
    if (error.status === 400 || error.status === 401) return "Incorrect email or password.";
  }
  return copy.failed("sign you in");
}

/** Only same-origin app paths the user can open; anything else lands on the role home at "/". */
function landingPath(next: string | undefined, permissions: string[]) {
  if (!next) return "/";
  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname.startsWith("/login")) return "/";
    if (!canAccessPath(permissions, url.pathname)) return "/";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}

export function LoginForm({ next }: { next?: string }) {
  const { login } = useAuth();
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [signedIn, setSignedIn] = React.useState(false);

  const form = useZodForm(loginSchema, { defaultValues: { email: "", password: "" } });
  const submitting = form.formState.isSubmitting;

  const onSubmit = async (values: LoginValues) => {
    if (signedIn) return;
    setSubmitError(null);
    try {
      const user = await login(values.email, values.password);
      setSignedIn(true);
      router.replace(landingPath(next, user.permissions));
      router.refresh();
    } catch (err) {
      setSubmitError(submitErrorMessage(err));
    }
  };

  return (
    <Form form={form} schema={loginSchema} onSubmit={onSubmit} className="flex flex-col">
      <div aria-live="assertive" aria-atomic="true">
        {submitError ? (
          <p className="mb-6 rounded-control border border-danger-border bg-danger-soft px-3 py-2.5 text-body text-danger">
            {submitError}
          </p>
        ) : null}
      </div>

      <div className={FIELDS}>
        <TextField
          name="email"
          label="Work email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@company.com"
          leadingIcon={Mail}
          className={FIELD_SLOT}
        />
        <PasswordField
          name="password"
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          leadingIcon={LockKeyhole}
          className={FIELD_SLOT}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        loading={submitting}
        disabled={signedIn}
        className="mt-4 h-11 w-full rounded-xl text-body shadow-[inset_0_1px_0_0_rgb(255_255_255/0.18),0_8px_20px_-8px_color-mix(in_srgb,var(--brand)_60%,transparent)] transition-[color,background-color,border-color,opacity,translate,box-shadow] hover:-translate-y-px active:translate-y-0 motion-reduce:hover:translate-y-0"
      >
        {signedIn ? (
          <span
            key="signed-in"
            className="inline-flex items-center gap-1.5 transition-opacity duration-(--motion-base) ease-standard starting:opacity-0 motion-reduce:transition-none"
          >
            <Check aria-hidden />
            Signed in
          </span>
        ) : submitting ? (
          "Signing in…"
        ) : (
          "Sign in"
        )}
      </Button>

      <p role="status" className="mt-3 min-h-4 text-center text-meta">
        {signedIn ? "Opening your workspace…" : null}
      </p>
    </Form>
  );
}
