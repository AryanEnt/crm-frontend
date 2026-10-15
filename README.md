This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Public pages for Google OAuth

The public Application Home Page, Privacy Policy, and Terms of Service are available at `/`,
`/privacy`, and `/terms`. The authenticated CRM dashboard is at `/dashboard`; public pages
do not require a CRM session.

Set `NEXT_PUBLIC_SITE_URL` to the production site's HTTPS origin using the real domain you
control. The value must be an origin without a path or credentials. When set, the public
pages use it for canonical URLs. It is public configuration, not a secret. Leave it empty
for local development.

Before publication, replace the support and privacy contact placeholders in
`components/public/public-site.tsx` and the legal-operator, registered-address, and governing-
jurisdiction placeholders in `app/terms/page.tsx`. Confirm policy statements about production
hosting, data regions, retention, deletion, and security against the deployed service, and
have the Terms reviewed for the operator's legal identity and applicable jurisdiction.

In Google Cloud Console, enter the real HTTPS URLs for the application's home page
(`/`), Privacy Policy (`/privacy`), and Terms of Service (`/terms`). Add only a domain
that you control and that meets Google's Authorized Domains requirements; do not assume a
provider-generated hostname is eligible. Verify ownership of the domain as requested by
Google. These pages prepare the app for review but do not establish that Google has verified
or approved it.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
