"use client";

import { useState } from "react";
import { Table } from "@tanstack/react-table";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import QRCode from "qrcode";
import ImageLogo from "@/public/icon-192x192.png";
import axios from "axios";
import { mutate } from "swr";

interface FloatingSelectionBarProps<TData> {
  table: Table<TData>;
  departmentId: string; //
}

export function FloatingSelectionBar<TData>({ table, departmentId }: FloatingSelectionBarProps<TData>) {
  const selectedRows = table.getSelectedRowModel().rows;
  const hasSelection = selectedRows.length > 0;
  const [loading, setLoading] = useState(false);

  const handleBatchDownload = async () => {
    setLoading(true);



    try {
      if (selectedRows.length === 1) {
        // ✅ Single employee -> download PNG directly
        const employee: any = selectedRows[0].original;
        const qrValue = `${process.env.NEXT_PUBLIC_URL}/view/employee/${employee.id}`;

        const canvas = document.createElement("canvas");
        await QRCode.toCanvas(canvas, qrValue, { width: 400 });
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Load logo
          const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.src = ImageLogo.src;
            img.onload = () => resolve(img);
            img.onerror = reject;
          });

          // Draw logo in the center
          const logoSize = canvas.width * 0.2;
          const x = (canvas.width - logoSize) / 2;
          const y = (canvas.height - logoSize) / 2;
          ctx.drawImage(logo, x, y, logoSize, logoSize);
        }

        canvas.toBlob((blob) => {
          if (blob) {
            saveAs(blob, `${employee.employeeNo}.png`);
            toast.success(`QR Code for ${employee.employeeNo} downloaded!`);
          }
          setLoading(false);
        });
        return;
      }

      // ✅ Multiple employees -> ZIP
      const zip = new JSZip();

      for (const row of selectedRows) {
        const employee: any = row.original;
        const qrValue = `${process.env.NEXT_PUBLIC_URL}/view/employee/${employee.id}`;

        const canvas = document.createElement("canvas");
        await QRCode.toCanvas(canvas, qrValue, { width: 400 });
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.src = ImageLogo.src;
          img.onload = () => resolve(img);
          img.onerror = reject;
        });

        const logoSize = canvas.width * 0.2;
        const x = (canvas.width - logoSize) / 2;
        const y = (canvas.height - logoSize) / 2;
        ctx.drawImage(logo, x, y, logoSize, logoSize);

        const imgData = canvas.toDataURL("image/png");
        zip.file(`${employee.employeeNo}.png`, imgData.split("base64,")[1], {
          base64: true,
        });
      }

      const blob = await zip.generateAsync({ type: "blob" });

      // ✅ Add date + time to filename
      const now = new Date();
      const timestamp = now
        .toISOString()
        .replace(/T/, "-")
        .replace(/\..+/, "")
        .replace(/:/g, "-");

      saveAs(blob, `employee-qr-codes-${timestamp}.zip`);
      toast.success(`${selectedRows.length} QR codes exported as ZIP!`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to export QR codes.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkArchive = async (archived: boolean) => {
    try {
      setLoading(true);

      const ids = selectedRows.map((row) => (row.original as any).id);

      await axios.patch(`/api/${departmentId}/employees/archive`, {
        employeeIds: ids,
        archived,
      });

      toast.success(
        archived
          ? `${ids.length} employees archived`
          : `${ids.length} employees unarchived`
      );
          // 🔄 Refresh employees list via SWR
    mutate(`/api/${departmentId}/employees`);

      // Optional: refresh or clear selections
      table.resetRowSelection();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update employees.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <AnimatePresence>
      {hasSelection && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md"
        >
          <Card
  className="
    flex flex-col md:flex-row gap-3 md:gap-4
    items-center md:items-center
    justify-between
    p-4 shadow-lg rounded-2xl border
    bg-background/90 backdrop-blur-md
  "
>
  {/* Selection count */}
  <span className="text-sm font-medium text-center md:text-left w-full md:w-auto">
    {selectedRows.length} selected
  </span>

  {/* Action buttons */}
  <div
    className="
      flex flex-col sm:flex-row w-full md:w-auto
      gap-2 justify-center md:justify-end
    "
  >
    <Button
      onClick={handleBatchDownload}
      disabled={loading}
      size="sm"
      className="flex items-center gap-1 w-full sm:w-auto"
    >
      {loading ? "Exporting..." : "Export QR Codes"}
    </Button>

    <Button
      onClick={() => handleBulkArchive(true)}
      disabled={loading}
      size="sm"
      variant="destructive"
      className="w-full sm:w-auto"
    >
      Archive
    </Button>

    <Button
      onClick={() => handleBulkArchive(false)}
      disabled={loading}
      size="sm"
      variant="outline"
      className="w-full sm:w-auto"
    >
      Unarchive
    </Button>
  </div>
</Card>


        </motion.div>
      )}
    </AnimatePresence>
  );
}
