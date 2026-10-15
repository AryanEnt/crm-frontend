import {
  ContactPlaceholder,
  LegalPage,
  type LegalSection,
} from "@/components/public/public-site";
import { publicPageMetadata } from "@/lib/public-site";

const UPDATED = "October 15, 2026";

export const metadata = publicPageMetadata(
  "Terms of Service",
  "Terms governing access to and use of Aurora CRM.",
  "/terms",
);

const sections: LegalSection[] = [
  {
    id: "acceptance",
    title: "Acceptance of these terms",
    content: (
      <p>
        These Terms of Service govern access to and use of Aurora CRM. By accessing or
        using the service, you agree to these terms. If you use Aurora CRM on behalf of an
        organization, you confirm that you are authorized to accept these terms for that
        organization. The operator’s legal identity must be completed before publication:{" "}
        <strong>[entegrasources.com]</strong>.
      </p>
    ),
  },
  {
    id: "service",
    title: "Description of the service",
    content: (
      <p>
        Aurora CRM is a customer relationship management service for sales teams. It
        supports management of leads, contacts, organizations, opportunities, activities,
        communications, and related reporting. Some features depend on configuration,
        permissions, and third-party services.
      </p>
    ),
  },
  {
    id: "accounts",
    title: "Accounts and account security",
    content: (
      <p>
        You must use accurate account information, keep your sign-in credentials
        confidential, and promptly notify your workspace administrator if you believe your
        account has been accessed without permission. Workspace administrators manage user
        access and roles. You are responsible for activity carried out through your
        account, subject to applicable law.
      </p>
    ),
  },
  {
    id: "gmail",
    title: "Connecting a Gmail account",
    content: (
      <p>
        Connecting Google is optional and requires your authorization through Google. You
        are responsible for choosing the account to connect, reviewing the permissions
        requested, and ensuring you have authority to use that account for your work. You
        may disconnect it in CRM settings and revoke Google access through your Google
        Account. You remain responsible for complying with your organization’s policies
        and Google’s applicable terms.
      </p>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    content: (
      <p>
        You may use the service only for lawful business purposes and in accordance with
        your organization’s policies. Do not misuse the service, attempt unauthorized
        access, interfere with its operation, submit unlawful or infringing content, or
        use it in a way that violates another person’s rights or applicable law.
      </p>
    ),
  },
  {
    id: "ownership",
    title: "Customer data and submitted content",
    content: (
      <p>
        As between you and the service operator, you or your organization retain rights
        you hold in the data and content submitted to Aurora CRM. You authorize the
        operator to host, process, and display that content as needed to provide and
        operate the service and as described in the Privacy Policy. You are responsible
        for having the rights and permissions needed to submit the content.
      </p>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party services",
    content: (
      <p>
        Aurora CRM may connect to services provided by third parties, including Google.
        Those services are subject to their own terms and privacy practices. The operator
        does not control third-party services or guarantee their availability or
        functionality.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Availability and maintenance",
    content: (
      <p>
        The service may be temporarily unavailable for maintenance, updates, or events
        outside the operator’s control. No specific uptime commitment is made by these
        terms. The operator may change or discontinue features, subject to applicable law
        and any separate written agreement.
      </p>
    ),
  },
  {
    id: "suspension",
    title: "Suspension and termination",
    content: (
      <p>
        Access may be suspended or terminated when needed to protect the service or its
        users, address a violation of these terms, follow an organization administrator’s
        instruction, or comply with law. Account holders should contact their workspace
        administrator to understand organization-specific account access or closure
        procedures.
      </p>
    ),
  },
  {
    id: "termination-data",
    title: "Data handling when use ends",
    content: (
      <p>
        Ending a Gmail connection clears the CRM’s stored Google OAuth tokens but does not
        by itself delete previously synchronized messages from the CRM. When an account or
        workspace is closed, data handling depends on the organization’s instructions,
        available deletion controls, applicable legal obligations, and backup practices.
        Contact the workspace administrator or <ContactPlaceholder kind="support" /> to
        request information or deletion. Specific retention periods have not been
        established in these terms.
      </p>
    ),
  },
  {
    id: "disclaimer",
    title: "Disclaimers and limitation of liability",
    content: (
      <p>
        To the extent permitted by applicable law, the service is provided without
        warranties not expressly stated in a separate written agreement. Nothing in these
        terms excludes or limits liability that cannot lawfully be excluded or limited.
      
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    content: (
      <p>
        The operator may update these terms and will post the current version on this page
        with a revised “Last updated” date. Continued use after an update takes effect is
        subject to the updated terms, to the extent permitted by applicable law.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <p>
        For questions about these terms, contact <ContactPlaceholder kind="support" />.
        The service operator’s legal name and registered business address have not been
        verified in the project:
        <strong> [REGISTERED BUSINESS ADDRESS —
Behind BICC Bajracharya House, Kathmandu, Nepal]</strong>.
        Complete these details and have counsel review the terms before publication.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="Terms for using Aurora CRM and connecting third-party accounts."
      updated={UPDATED}
      sections={sections}
    />
  );
}
