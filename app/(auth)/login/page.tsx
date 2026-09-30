import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { cn } from "@/lib/utils";
import { LoginForm } from "@/features/auth/login-form";
import { AuroraGlow, AuroraPreviewCard, AuroraPreviewCompact } from "@/features/auth/aurora-preview";

export const metadata: Metadata = {
  title: "Sign in",
};

function Wordmark({ size }: { size: "lg" | "sm" }) {
  return (
    <div className={cn("flex items-center", size === "lg" ? "gap-3" : "gap-2.5")}>
      <BrandMark className={cn("aurora-mark", size === "lg" && "size-10 rounded-xl text-body")} />
      <span className={cn("text-ink", size === "lg" ? "text-title" : "text-page-title")}>CRMAurora</span>
    </div>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="auth-aurora grid min-h-dvh bg-(--aurora-warm) md:grid-cols-2 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden border-r border-(--aurora-line) bg-(--aurora-canvas) md:flex md:flex-col md:px-8 md:py-10 lg:px-14 lg:py-12 xl:px-20">
        <AuroraGlow />
        <div className="relative flex flex-1 flex-col">
          <Wordmark size="lg" />
          <div className="flex flex-1 flex-col justify-center py-10">
            <p className="max-w-md text-xl font-semibold leading-snug tracking-tight text-ink lg:text-[1.75rem] lg:leading-9">
              Everything your sales team needs to move opportunities forward.
            </p>
            <AuroraPreviewCard className="mx-auto mt-10 mb-6 w-full max-w-sm lg:mt-12 lg:max-w-120" />
          </div>
        </div>
      </aside>

      <section className="relative flex items-center justify-center overflow-hidden px-6 py-10 sm:px-10 md:py-12">
        <div className="w-full max-w-100 md:max-w-108">
          <div className="mb-10 md:hidden">
            <Wordmark size="sm" />
            <AuroraPreviewCompact className="mt-6" />
          </div>

          <div className="md:aurora-form-card md:rounded-[24px] md:p-9 md:pb-6">
            <h1 className="text-[1.625rem] font-semibold leading-8 tracking-tight text-ink">Welcome back</h1>
            <p className="mt-2 text-body text-ink-muted">
              Sign in with the account your workspace admin set up for you.
            </p>
            <div className="mt-8">
              <LoginForm next={typeof next === "string" ? next : undefined} />
            </div>
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-(--aurora-lavender)/60 px-4 py-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface text-(--aurora-lavender-ink) shadow-xs">
              <ShieldCheck aria-hidden className="size-3.5" />
            </span>
            <div>
              <p className="text-caption font-medium text-ink">Protected workspace</p>
              <p className="mt-0.5 text-meta">Need access or a password reset? Ask your workspace admin.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
