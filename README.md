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

## OAuth sign-in

The app supports Google and GitHub OAuth through Auth.js, with users, linked accounts, and sessions persisted in PostgreSQL through Prisma. Copy `.env.example` to `.env`, create OAuth apps with each provider, and fill in the client IDs and secrets. Set the provider callback URLs to:

- Google: `http://localhost:3000/api/auth/callback/google`
- GitHub: `http://localhost:3000/api/auth/callback/github`

Generate an `AUTH_SECRET` with `pnpm exec auth secret`. For production, use the deployed site's origin in each provider's callback URL and set `AUTH_TRUST_HOST=true` only when the deployment's host/proxy configuration is trusted.

### PostgreSQL and Prisma

Start the local PostgreSQL service with `docker compose up -d db`, then create and apply the initial migration with `pnpm db:migrate --name init`. Regenerate the Prisma client after schema changes with `pnpm db:generate`; use `pnpm db:studio` to inspect the database. Set `DATABASE_URL` in `.env` to your PostgreSQL connection string before running migrations.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
