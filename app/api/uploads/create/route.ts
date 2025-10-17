import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { randomUUID } from "crypto";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per workbook

const RequestSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive(),
  type: z.string().min(1).max(255).optional(),
});

const BLOB_API_BASE =
  process.env.VERCEL_BLOB_API_URL ||
  process.env.NEXT_PUBLIC_VERCEL_BLOB_API_URL ||
  "https://vercel.com/api/blob";

const BLOB_PUBLIC_BASE =
  process.env.NEXT_PUBLIC_BLOB_BASE_URL ||
  process.env.BLOB_PUBLIC_BASE_URL ||
  "https://v0.blob.vercel-storage.com";

const BLOB_API_VERSION = "11";

type CreateResponse = {
  fileId: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  blobPath: string;
  publicUrl: string;
  expiresAt: number;
};

const sanitizeFilename = (name: string) => {
  const trimmed = name.trim();
  const dotIndex = trimmed.lastIndexOf(".");
  const base = dotIndex > 0 ? trimmed.slice(0, dotIndex) : trimmed;
  const extension = dotIndex > 0 ? trimmed.slice(dotIndex + 1) : "";
  const normalizedBase = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const safeBase = normalizedBase.length ? normalizedBase : "workbook";
  if (!extension) return safeBase;
  const safeExtension = extension.replace(/[^a-z0-9]+/gi, "");
  return safeExtension.length ? `${safeBase}.${safeExtension}` : safeBase;
};

const ensureBlobToken = () => {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  console.error("Missing BLOB_READ_WRITE_TOKEN environment variable");
  return false;
};

const createUploadHeaders = (token: string, size: number, contentType?: string) => {
  const [, , , storeId = "store"] = token.split("_");
  const requestId = `${storeId}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "x-api-version": BLOB_API_VERSION,
    "x-api-blob-request-id": requestId,
    "x-api-blob-request-attempt": "0",
    "x-content-length": String(size),
  };
  if (contentType) {
    headers["x-content-type"] = contentType;
  }
  return headers;
};

export async function POST(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ensureBlobToken()) {
    return NextResponse.json(
      { error: "Blob storage is not configured." },
      { status: 500 }
    );
  }

  let payload: z.infer<typeof RequestSchema>;
  try {
    const json = await request.json();
    payload = RequestSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }

  if (payload.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `File is too large. Maximum allowed size is ${Math.floor(
          MAX_FILE_SIZE_BYTES / (1024 * 1024)
        )} MB.`,
      },
      { status: 413 }
    );
  }

  const sanitizedName = sanitizeFilename(payload.name);
  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const fileId = randomUUID();
  const blobPath = `attendance/${userId}/${folder}/${fileId}-${sanitizedName}`;

  try {
    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname: blobPath,
      maximumSizeInBytes: MAX_FILE_SIZE_BYTES,
      allowedContentTypes: payload.type ? [payload.type] : undefined,
      addRandomSuffix: false,
      allowOverwrite: false,
    });

    const params = new URLSearchParams({ pathname: blobPath });
    const uploadUrl = `${BLOB_API_BASE}/?${params.toString()}`;
    const uploadHeaders = createUploadHeaders(
      clientToken,
      payload.size,
      payload.type
    );

    const response: CreateResponse = {
      fileId,
      uploadUrl,
      uploadHeaders,
      blobPath,
      publicUrl: `${BLOB_PUBLIC_BASE}/${blobPath}`,
      expiresAt: Date.now() + 60_000,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to generate blob upload URL", error);
    const message =
      error instanceof Error ? error.message : "Unable to prepare upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

