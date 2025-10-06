import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

function uploadBufferToCloudinary(buf: Buffer, publicId?: string) {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "hrps/rembg",
        public_id: publicId,
        resource_type: "image",
        format: "png",           // keep transparency
        overwrite: true,
      },
      (err, res) => {
        if (err) return reject(err);
        resolve(res!.secure_url);
      }
    );
    stream.end(buf);
  });
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type") || "";
    let imageInput: string | Buffer;
    let publicId: string | undefined;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });
      const ab = await file.arrayBuffer();
      imageInput = Buffer.from(ab);
      publicId = (form.get("publicId") as string) || undefined;
    } else {
      const body = await req.json().catch(() => ({}));
      if (!body?.imageUrl) {
        return NextResponse.json(
          { error: "Send multipart/form-data with `file` or JSON { imageUrl }" },
          { status: 400 }
        );
      }
      imageInput = body.imageUrl as string;
      publicId = body.publicId as string | undefined;
    }

    const version = "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003"; // cjwbw/rembg
    const output: any = await replicate.run(`cjwbw/rembg:${version}`, {
      input: { image: imageInput },
    });

    // Normalize output -> Buffer
  let outBuf: Buffer | null = null;
if (output?.arrayBuffer) outBuf = Buffer.from(await output.arrayBuffer());
else if (output instanceof Uint8Array) outBuf = Buffer.from(output);
else if (output?.url) {
  const res = await fetch(output.url());
  outBuf = Buffer.from(await res.arrayBuffer());
} else if (typeof output === "string") {
  const res = await fetch(output);
  outBuf = Buffer.from(await res.arrayBuffer());
}
const secureUrl = await uploadBufferToCloudinary(outBuf!);
return NextResponse.json({ url: secureUrl });
  } catch (err: any) {
    console.error("rembg error:", err);
    return NextResponse.json({ error: err?.message || "Failed to process image" }, { status: 500 });
  }
}
