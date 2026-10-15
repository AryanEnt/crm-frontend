import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";

export function PublicHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-control"
          aria-label="Aurora CRM home"
        >
          <BrandMark label="A" />
          <span className="text-cell font-semibold tracking-tight text-ink">
            Aurora CRM
          </span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-4 text-body">
          <Link
            className="text-ink-muted transition-colors hover:text-ink"
            href="/privacy"
          >
            Privacy
          </Link>
          <Link className="text-ink-muted transition-colors hover:text-ink" href="/terms">
            Terms
          </Link>
          <Link
            className="rounded-control bg-brand px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-brand-hover"
            href="/login"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-body text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>© {new Date().getFullYear()} Aurora CRM</span>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link className="hover:text-ink" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="hover:text-ink" href="/terms">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}

export type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

export function LegalPage({
  title,
  intro,
  updated,
  sections,
}: {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <PublicLayout>
      <main className="mx-auto grid max-w-7xl gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <p className="text-caption font-semibold uppercase tracking-[0.16em] text-brand">
            Aurora CRM
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 text-body leading-6 text-ink-muted">{intro}</p>
          <p className="mt-4 text-caption text-ink-muted">Last updated: {updated}</p>
          <nav
            aria-label={`${title} sections`}
            className="mt-7 hidden border-l border-line pl-4 lg:block"
          >
            <p className="mb-3 text-caption font-semibold text-ink">On this page</p>
            <ol className="space-y-2.5">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    className="text-caption leading-5 text-ink-muted hover:text-brand"
                    href={`#${section.id}`}
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
        <article className="min-w-0 space-y-10">
          <nav
            aria-label={`${title} section navigation`}
            className="rounded-xl border border-line bg-surface p-5 lg:hidden"
          >
            <p className="mb-3 text-caption font-semibold text-ink">On this page</p>
            <ol className="grid gap-2 sm:grid-cols-2">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    className="text-body text-brand underline-offset-4 hover:underline"
                    href={`#${section.id}`}
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-heading`}
              className="scroll-mt-8"
            >
              <h2
                id={`${section.id}-heading`}
                className="text-xl font-semibold tracking-tight text-ink"
              >
                {index + 1}. {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-body leading-7 text-ink-secondary">
                {section.content}
              </div>
            </section>
          ))}
        </article>
      </main>
    </PublicLayout>
  );
}

export function ContactPlaceholder({ kind }: { kind: "support" | "privacy" }) {
  return (
    <span className="font-medium text-ink">
      [{kind === "support" ? "SUPPORT EMAIL" : "PRIVACY CONTACT EMAIL"} — hr@entegrasources.com]
    </span>
  );
}
