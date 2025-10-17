# Blob storage configuration

The attendance evaluator uploads raw XLS/XLSX files to [Vercel Blob](https://vercel.com/storage/blob) before they are parsed on
the server. This document explains how to provision a store, create credentials, and expose them to the application in both
local and hosted environments.

## 1. Create a Blob store

1. Sign in to your Vercel account and open the project that hosts this app.
2. In the left sidebar, choose **Storage** → **Blob**.
3. Click **Create Store**, pick a region close to your users, and give the store a recognizable name (for example,
   `attendance-logs`).

> Each store provides an automatically generated base URL in the form
> `https://<store-id>.public.blob.vercel-storage.com`. You can find it on the store overview page; it is required when you want
> to expose uploaded files for download or processing.

## 2. Generate a read/write token

1. Open the store you just created and go to the **Tokens** tab.
2. Click **Generate Token** and choose **Read/Write** access.
3. Copy the token value; it has the format `vercel_blob_rw_<team-id>_<store-id>_<random-suffix>`.

Treat this token as a secret. Anyone with access can overwrite or delete objects in the store.

## 3. Configure environment variables

The API route at `app/api/uploads/create/route.ts` requires the following variables:

| Variable | Required | Description |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Yes | The read/write token created above. Used to mint one-time client upload tokens. |
| `NEXT_PUBLIC_BLOB_BASE_URL` | Optional | Overrides the public base URL returned to the client. Set this to the store base URL if you want to avoid relying on the default `https://v0.blob.vercel-storage.com`. |
| `NEXT_PUBLIC_VERCEL_BLOB_API_URL` | Optional | Only needed when pointing to a non-default Blob API endpoint (for example, when using the Vercel CLI proxy). |

### Local development

1. Create a `.env.local` file in the repository root (Next.js automatically loads it).
2. Add the token you generated along with any optional overrides:

   ```dotenv
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_<team-id>_<store-id>_<random-suffix>
   NEXT_PUBLIC_BLOB_BASE_URL=https://<store-id>.public.blob.vercel-storage.com
   ```

3. Restart `npm run dev` so the new environment variables are picked up.

### Vercel deployment

1. In the Vercel project dashboard, go to **Settings** → **Environment Variables**.
2. Add the same variables for each environment you deploy to (Production, Preview, Development).
3. Trigger a redeploy so the build uses the new credentials.

## 4. Verify the setup

1. Start the dev server and open the Biometrics → Logs uploader UI.
2. Upload a workbook. If configuration is correct, the `POST /api/uploads/create` request should return a `200` status with an
   `uploadUrl`. The browser will then `PUT` the file directly to Vercel Blob.
3. You can also verify with `curl`:

   ```bash
   curl -X POST http://localhost:3000/api/uploads/create \
     -H 'Content-Type: application/json' \
     -d '{"name":"test.xls","size":1024,"type":"application/vnd.ms-excel"}'
   ```

   The response should contain `uploadUrl`, `blobPath`, and `publicUrl`.

If you still see the "Blob storage is not configured" error, double-check that the server process can read
`BLOB_READ_WRITE_TOKEN` (log it locally with `console.log(process.env.BLOB_READ_WRITE_TOKEN)` if necessary) and restart the
server after any changes.
