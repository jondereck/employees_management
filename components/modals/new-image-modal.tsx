"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus } from "lucide-react";

import { toast } from "sonner";
import EditImageModal from "./edit-image-modal";

type Props = {
  onFinalUrl: (url: string) => void; // set value in your form
};

export default function NewEmployeePhoto({ onFinalUrl }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [workingUrl, setWorkingUrl] = useState<string>(""); // what editor receives

  // A) Local file path → send to /api/tools/rembg (multipart) → get Cloudinary URL → open editor
  async function handlePickLocalFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.message("Uploading…", { description: "Preparing image…" });
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/tools/rembg", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      setWorkingUrl(data.url);        // Cloudinary url
      setEditorOpen(true);            // open editor with removable BG already applied
      toast.success("Image loaded");
    } catch (err: any) {
      toast.error("Failed to load image", { description: err?.message ?? "Try again." });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // B) Cloudinary widget alternative (if you still want it)
  async function openCloudinaryWidget() {
    // If using CldUploadWidget, trigger it from here instead.
    // After success: setWorkingUrl(secure_url); setEditorOpen(true);
    toast.message("Hook Cloudinary widget here if desired.");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {/* Local file with server-side BG removal before editor */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePickLocalFile}
        />
        <Button type="button" onClick={() => fileInputRef.current?.click()}>
          <ImagePlus className="mr-2 h-4 w-4" />
          Upload & Edit
        </Button>

        {/* Or, use Cloudinary widget path */}
        {/* <Button type="button" variant="secondary" onClick={openCloudinaryWidget}>
          Use Cloudinary Widget
        </Button> */}
      </div>

      <EditImageModal
        open={editorOpen}
        initialUrl={workingUrl}
        onCancel={() => setEditorOpen(false)}
        onDone={(finalUrl) => {
          setEditorOpen(false);
          onFinalUrl(finalUrl); // set into RHF or local state for the new employee
          toast.success("Photo ready");
        }}
      />
    </div>
  );
}
