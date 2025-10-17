# Employees Management

Employee attendance and HR tooling built with Next.js App Router.

## Requirements

- Node.js 20.x (see `package.json` engines field)
- npm 10.x
- A PostgreSQL database and the environment variables required by the rest of the app (Clerk, Pusher, etc.)

## Getting started locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Provide the environment variables expected by the app. Create a `.env.local` file in the project root and add the values you
   use in development. At minimum, configure [Vercel Blob](./docs/blob-storage.md) so attendance log uploads can be tested.
3. Generate the Prisma client (runs automatically after `npm install`, but you can run it manually if you change the schema):
   ```bash
   npx prisma generate
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

## Production deployment

Deploying to [Vercel](https://vercel.com/) is recommended. Make sure to configure the same environment variables for each
environment (Production, Preview, and Development). Follow the [Blob storage guide](./docs/blob-storage.md) so the
`/api/uploads/create` endpoint can mint signed upload URLs when the app is running in the cloud.

## Additional documentation

- [Blob storage configuration](./docs/blob-storage.md)
- [Keeping a fork in sync](./docs/git-sync.md)
