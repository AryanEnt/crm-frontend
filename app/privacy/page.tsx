import {
  LegalPage,
  type LegalSection,
  ContactPlaceholder,
} from "@/components/public/public-site";
import { publicPageMetadata } from "@/lib/public-site";

const UPDATED = "October 15, 2026";

export const metadata = publicPageMetadata(
  "Privacy Policy",
  "Learn how Aurora CRM collects, uses, stores, and protects account, CRM, and Google Gmail data.",
  "/privacy",
);

const sections: LegalSection[] = [
  {
    id: "scope",
    title: "Introduction and scope",
    content: (
      <p>
        This Privacy Policy describes how Aurora CRM handles information when you use the
        CRM website and services, including the optional Gmail integration. It applies to
        account holders and people whose information is entered into a customer or
        prospect record. A customer organization may separately determine how its users
        use and manage CRM records.
      </p>
    ),
  },
  {
    id: "information",
    title: "Information we collect",
    content: (
      <>
        <p>
          <strong>Account and profile information:</strong> work email, name, account
          credentials, role, and permissions used to administer access to a workspace.
          Passwords are handled by the application’s authentication service and are not
          the same as Google account credentials.
        </p>
        <p>
          <strong>Business and CRM records:</strong> information users enter or maintain
          about leads, contacts, organizations, opportunities, activities, calls, notes,
          documents, and related communications. Records may contain personal information
          about customers and prospects.
        </p>
        <p>
          <strong>Google account information:</strong> when a user connects Google, the
          integration receives the Google email address and the profile name and profile
          image returned by Google’s user-info endpoint.
        </p>
        <p>
          <strong>Gmail data:</strong> as described in the Gmail section below, the
          integration reads message content and metadata needed for CRM email features and
          sends messages when the user asks it to.
        </p>
        <p>
          <strong>Technical and diagnostic information:</strong> authentication session
          records include request IP address and user-agent information. The service also
          records operational and integration diagnostics; Google API error details are
          sanitized to remove token-like values before they are logged.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use information",
    content: (
      <p>
        Information is used to provide and operate the CRM, authenticate users, enforce
        workspace permissions, manage customer and sales records, display synchronized
        email, send email at a user’s direction, match email conversations to CRM records,
        maintain service health, troubleshoot errors, and protect the service. Google user
        data is used for the email features described here and for the limited security,
        legal, and other purposes described in this policy.
      </p>
    ),
  },
  {
    id: "gmail",
    title: "Gmail and Google API access",
    content: (
      <>
        <p>
          Google’s consent request asks for <code>gmail.readonly</code>,{" "}
          <code>gmail.send</code>, <code>userinfo.email</code>, and{" "}
          <code>userinfo.profile</code>. The profile permissions identify the connected
          Google account. Gmail read-only access lets Aurora CRM retrieve email; Gmail
          send access lets the CRM send messages that a user composes or schedules. The
          application does not request Gmail modify or delete permissions.
        </p>
        <p>
          On connection, the service retrieves the Gmail profile and synchronizes up to 40
          recent inbox messages. When Gmail push synchronization is configured, it uses
          Gmail history notifications to synchronize newly added messages. For a
          synchronized message, the service requests the full message payload and stores
          message bodies (HTML and plain text, when present), snippets, subject, sender
          and recipient addresses, dates, thread details, and CRM associations in its
          database. Email subject and preview text are indexed for thread search.
        </p>
        <p>
          For attachments, the sync process stores the filename, media type, size, and
          Gmail attachment identifier. It does not save the attachment file contents to
          CRM storage in the synchronization code. When a user sends an email, message
          content and recipient information are sent to Google to deliver that message.
          Gmail access tokens are stored encrypted in the backend database.
        </p>
        <p>
          A user can disconnect a Google account in the CRM’s email account settings. This
          stops the CRM’s Gmail watch and clears its stored access and refresh tokens, but
          does not delete email records already synchronized into the CRM. To revoke the
          app’s Google grant as well, use{" "}
          <a
            className="text-brand underline-offset-4 hover:underline"
            href="https://myaccount.google.com/permissions"
            rel="noreferrer"
            target="_blank"
          >
            Google Account permissions
          </a>
          . Revoking either connection does not itself erase previously synchronized CRM
          email records.
        </p>
        <p>
          <strong>Google API Services User Data Policy — Limited Use.</strong> Aurora
          CRM’s use and transfer of information received from Google APIs adheres to the
          Google API Services User Data Policy, including the Limited Use requirements.
          Google data is used only to provide or improve user-facing email features that
          are prominent in the application interface, to protect against abuse or security
          incidents, to comply with applicable law, or as otherwise permitted by the
          policy. Google data is not transferred to others except as necessary to provide
          or improve those features, to comply with applicable law, or as part of a
          merger, acquisition, or sale of assets with user notice where required. People
          are not permitted to read Google data except with the user’s affirmative
          agreement, for security purposes, to comply with law, or where the data has been
          aggregated and anonymized in accordance with the policy. This statement does not
          represent Google certification or app verification.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Data sharing",
    content: (
      <p>
        Data is processed by Google when a user connects Gmail or sends email, and by the
        hosting and database infrastructure used to operate the service. The project’s
        deployment documentation identifies Railway for service hosting and PostgreSQL for
        application data; the exact production hosting and database configuration should
        be confirmed by the service operator. Workspace users and administrators may
        access records according to their assigned permissions. Information may also be
        disclosed when required by law, to respond to valid legal process, or to
        investigate or address security, fraud, or safety issues. The reviewed project
        does not establish every production data recipient; the service operator should
        confirm whether any additional processors or integrations are configured.
      </p>
    ),
  },
  {
    id: "retention",
    title: "Data retention and deletion",
    content: (
      <p>
        The reviewed application does not define a universal retention period. CRM records
        remain in the application database while maintained in a workspace. Disconnecting
        Gmail removes the stored Google tokens but leaves previously synchronized email
        records in the CRM. A workspace administrator or user with the required
        permissions can remove CRM records where that capability is provided. To request
        deletion of an account and associated data, contact{" "}
        <ContactPlaceholder kind="privacy" /> and your workspace administrator. Deletion
        timing, treatment of backups, and any applicable legal retention requirements must
        be confirmed with the service operator before publication.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security measures",
    content: (
      <p>
        The backend encrypts Google OAuth access and refresh tokens at rest using
        AES-256-GCM and applies authenticated access checks to CRM features. Diagnostic
        logging sanitizes token-like Google API values. No method of transmission or
        storage is completely secure, and these measures cannot guarantee absolute
        security. The operator should confirm the production database, backup, and
        infrastructure safeguards.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and authentication",
    content: (
      <p>
        The application uses browser cookies to maintain signed-in sessions. These cookies
        support authentication and access to protected CRM pages. If you block or clear
        them, sign-in or session functionality may not work as intended.
      </p>
    ),
  },
  {
    id: "transfers",
    title: "International data transfers",
    content: (
      <p>
        Google and the service’s hosting or database providers may process information in
        countries different from the country where it was collected. The production
        deployment regions and transfer safeguards have not been confirmed in the project
        configuration; the operator should document them before publication.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children’s privacy",
    content: (
      <p>
        Aurora CRM is a business service and is not designed for children. Do not use the
        service to knowingly provide children’s personal information unless your
        organization has confirmed an appropriate legal basis and safeguards.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your privacy rights and requests",
    content: (
      <p>
        Depending on where you live, you may have rights to access, correct, delete, or
        restrict certain information, or to object to certain processing. Contact{" "}
        <ContactPlaceholder kind="privacy" /> to make a privacy request. If your CRM
        account belongs to an organization, its administrator may need to help locate or
        manage workspace records. We may need to verify your identity and request before
        responding.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    content: (
      <p>
        We may update this policy as the service or applicable requirements change. The
        updated version will be posted on this page with a revised “Last updated” date. If
        a change materially affects how information is handled, the service operator will
        provide any notice required by applicable law.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <p>
        For privacy questions or requests, contact <ContactPlaceholder kind="privacy" />.
        Replace this placeholder with a monitored contact address before making this
        policy public.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="How Aurora CRM handles account, business, and Google Gmail information."
      updated={UPDATED}
      sections={sections}
    />
  );
}
