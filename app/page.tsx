import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarCheck2,
  Mail,
  Phone,
  UsersRound,
} from "lucide-react";
import { publicPageMetadata } from "@/lib/public-site";
import { ContactPlaceholder, PublicLayout } from "@/components/public/public-site";

export const metadata = publicPageMetadata(
  "Aurora CRM | Customer relationship management",
  "Aurora CRM helps sales teams organize leads, customer relationships, sales activity, and email in one workspace.",
  "/",
);

const features = [
  {
    icon: UsersRound,
    title: "Leads and contacts",
    description:
      "Keep prospect and customer records organized with the context your sales team needs.",
  },
  {
    icon: Building2,
    title: "Organizations and opportunities",
    description:
      "Connect people and organizations to sales opportunities and track progress through your pipeline.",
  },
  {
    icon: CalendarCheck2,
    title: "Sales activities",
    description:
      "Coordinate follow-ups, meetings, and day-to-day work with a shared activity and calendar view.",
  },
  {
    icon: Phone,
    title: "Calls and communication",
    description: "Keep communications connected to customer and prospect records.",
  },
  {
    icon: BarChart3,
    title: "Reporting",
    description:
      "Review sales activity, pipeline progress, and team performance in CRM reports.",
  },
  {
    icon: Mail,
    title: "Gmail integration",
    description:
      "Authorized users can connect a Google account to support the email functionality offered within Aurora CRM.",
  },
];

export default function PublicHomePage() {
  return (
    <PublicLayout>
      <main>
        <section className="mx-auto max-w-7xl px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
          <div className="max-w-3xl">
            <p className="text-caption font-semibold uppercase tracking-[0.18em] text-brand">
              A practical workspace for sales teams
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Build stronger customer relationships, one conversation at a time.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted">
              Aurora CRM brings sales records, opportunities, follow-ups, and customer
              communications into one workspace—so teams can stay organized and keep their
              work moving.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-control bg-brand px-5 py-2.5 text-body font-medium text-primary-foreground transition-colors hover:bg-brand-hover"
                href="/login"
              >
                Sign in to Aurora CRM <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link
                className="text-body font-medium text-brand underline-offset-4 hover:underline"
                href="/privacy"
              >
                How we handle data
              </Link>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="features-heading"
          className="border-y border-line bg-surface"
        >
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
            <div className="max-w-2xl">
              <p className="text-caption font-semibold uppercase tracking-[0.16em] text-brand">
                The workspace
              </p>
              <h2
                id="features-heading"
                className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
              >
                The details of selling, together.
              </h2>
              <p className="mt-3 text-body leading-7 text-ink-muted">
                Keep customer context close to the work, from first contact through
                ongoing account relationships.
              </p>
            </div>
            <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <li
                  key={title}
                  className="rounded-xl border border-line bg-background p-5 sm:p-6"
                >
                  <Icon aria-hidden className="size-5 text-brand" />
                  <h3 className="mt-4 text-cell font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-body leading-6 text-ink-muted">{description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="gmail-heading"
          className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16"
        >
          <div className="max-w-3xl rounded-2xl border border-line bg-surface p-6 sm:p-9">
            <div className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Mail aria-hidden className="size-5" />
              </span>
              <div>
                <h2
                  id="gmail-heading"
                  className="text-xl font-semibold tracking-tight text-ink"
                >
                  Email, with your permission
                </h2>
                <p className="mt-3 text-body leading-7 text-ink-muted">
                  Users can choose to connect a Google account. With the permissions they
                  authorize, Aurora CRM supports viewing and synchronizing email in the
                  CRM and sending email on the user’s behalf. Google account access is
                  used to provide these email features; details about the data accessed,
                  stored, and handled are in our{" "}
                  <Link
                    className="font-medium text-brand underline-offset-4 hover:underline"
                    href="/privacy"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Support" className="border-t border-line bg-surface">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-body sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-ink-muted">
              Need help? Contact support at <ContactPlaceholder kind="support" />.
            </p>
            <div className="flex gap-5">
              <Link
                className="text-brand underline-offset-4 hover:underline"
                href="/privacy"
              >
                Privacy Policy
              </Link>
              <Link
                className="text-brand underline-offset-4 hover:underline"
                href="/terms"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
