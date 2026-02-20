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
import { AlertModal } from "@/components/modals/alert-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Archive, ArchiveRestore, QrCode, Trash2, Globe, Globe2, MoreHorizontal } from "lucide-react";


type RowEmployee = { id: string; isArchived?: boolean; publicEnabled?: boolean };

interface FloatingSelectionBarProps<TData> {
  table: Table<TData>;
  departmentId: string; //
}

export function FloatingSelectionBar<TData>({ table, departmentId }: FloatingSelectionBarProps<TData>) {
  const selectedRows = table.getSelectedRowModel().rows;
  const hasSelection = selectedRows.length > 0;
  const [loading, setLoading] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);



  const selectedEmployees = selectedRows.map(r => r.original as RowEmployee);

  // Public toggle eligibility: ignore isArchived
  const eligibleForEnablePublic = selectedEmployees.filter(e => !e.publicEnabled);
  const eligibleForDisablePublic = selectedEmployees.filter(e => e.publicEnabled);

  // 2) Recompute eligibility using isArchived/publicEnabled
  const eligibleForArchive = selectedEmployees.filter(e => e.isArchived === false);
  const eligibleForUnarchive = selectedEmployees.filter(e => e.isArchived === true);


  // (optional, for hints)
  const countArchived = selectedEmployees.filter(e => e.isArchived).length;
  const countNotArchived = selectedEmployees.length - countArchived;

  const [archiveSheetOpen, setArchiveSheetOpen] = useState(false);
const [terminationDate, setTerminationDate] = useState<string | null>(null);

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
            const employeeNoSafe = employee.employeeNo.split(",")[0].trim(); // <-- take only before comma
            const fileName = `JDN${employeeNoSafe}.png`; // <-- prepend JDN
            saveAs(blob, fileName);
            toast.success(`QR Code for ${fileName} downloaded!`);
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
        zip.file(`${employee.employeeNo.split(",")[0].trim()}.png`, imgData.split("base64,")[1], {
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

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;

    setLoading(true);
    try {
      const ids = selectedRows.map((row) => (row.original as any).id);

      await axios.delete(`/api/${departmentId}/employees/delete`, {
        data: { employeeIds: ids },
      });


      toast.success(`${ids.length} employees deleted.`);
      mutate(`/api/${departmentId}/employees`);
      table.resetRowSelection();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete employees.");
    } finally {
      setLoading(false);
      setIsAlertOpen(false); // Close modal after deletion
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

  const handleArchiveWithDate = async () => {
  try {
    setLoading(true);

    const ids = selectedRows.map(
      (row) => (row.original as any).id
    );

    await axios.patch(`/api/${departmentId}/employees/archive`, {
      employeeIds: ids,
      archived: true,
      terminationDate: terminationDate
        ? new Date(terminationDate).toISOString()
        : undefined,
    });

    toast.success(`${ids.length} employees archived`);

    mutate(`/api/${departmentId}/employees`);
    table.resetRowSelection();
    setArchiveSheetOpen(false);
    setTerminationDate(null);
  } catch (error) {
    console.error(error);
    toast.error("Failed to archive employees.");
  } finally {
    setLoading(false);
  }
};

const handleBulkPublicToggle = async (enable: boolean) => {
  try {
    setLoading(true);

    const target = (enable
      ? eligibleForEnablePublic
      : eligibleForDisablePublic
    ).map((e) => e.id);

    if (target.length === 0) return;

    // ✅ OPTIMISTIC UPDATE FIRST
    await mutate(
      `/api/${departmentId}/employees`,
      (current: any[] | undefined) => {
        if (!current) return current;

        return current.map((emp) =>
          target.includes(emp.id)
            ? { ...emp, publicEnabled: enable }
            : emp
        );
      },
      false // don't revalidate yet
    );

    // THEN call API
    await axios.patch(
      `/api/${departmentId}/employees/toggle-public/bulk`,
      {
        employeeIds: target,
        enable,
      }
    );

    // THEN revalidate silently
    mutate(`/api/${departmentId}/employees`);

    table.resetRowSelection();
  } catch (error) {
    toast.error("Failed to toggle public profile");
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
          // use safe-area + center + side padding
          className="fixed inset-x-0 z-50 pb-[env(safe-area-inset-bottom)] bottom-3 px-3"
        >
          <AlertModal
            isOpen={isAlertOpen}
            onClose={() => setIsAlertOpen(false)}
            onConfirm={handleBulkDelete}
            loading={loading}
          />

          <Card
            className="
            mx-auto w-full max-w-3xl
            bg-background/90 backdrop-blur-md border shadow-xl rounded-2xl
            px-4 py-3
          "
          >
            <div className="flex items-center gap-3 flex-wrap">
              {/* Selection count */}
              <span className="text-sm font-medium shrink-0">{selectedRows.length} selected</span>

              {/* Desktop actions */}
              <div className="hidden md:flex items-center gap-2 flex-wrap ml-auto">
                <Button
                  onClick={handleBatchDownload}
                  disabled={loading}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <QrCode className="h-4 w-4" />
                  <span>QR Code</span>
                </Button>

                {/* Archive group */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="destructive" disabled={loading} className="flex items-center gap-2">
                      <Archive className="h-4 w-4" />
                      Archive
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                     onClick={() => setArchiveSheetOpen(true)}
                      disabled={eligibleForArchive.length === 0}
                      className="gap-2"
                    >
                      <Archive className="h-4 w-4" /> Archive selected
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => handleBulkArchive(false)}
                      disabled={eligibleForUnarchive.length === 0}
                      className="gap-2"
                    >
                      <ArchiveRestore className="h-4 w-4" /> Unarchive selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Public group */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="secondary" disabled={loading} className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Public
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">

                    <DropdownMenuItem
                      onClick={() => handleBulkPublicToggle(true)}
                      disabled={eligibleForEnablePublic.length === 0}
                      className="gap-2"
                      title={eligibleForEnablePublic.length === 0 ? "All selected already public" : "Enable public"}
                    >
                      <Globe className="h-4 w-4" /> Enable public
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => handleBulkPublicToggle(false)}
                      disabled={eligibleForDisablePublic.length === 0}
                      className="gap-2"
                      title={eligibleForDisablePublic.length === 0 ? "All selected already private" : "Disable public"}
                    >
                      <Globe2 className="h-4 w-4" /> Disable public
                    </DropdownMenuItem>
{/* 

                    <Button
                      onClick={() => handleBulkPublicToggle(true)}
                      disabled={loading || eligibleForEnablePublic.length === 0}
                      size="sm"
                      title={eligibleForEnablePublic.length === 0 ? "All selected already public" : "Enable public"}
                    >
                      Enable Public
                    </Button>

                    <Button
                      onClick={() => handleBulkPublicToggle(false)}
                      disabled={loading || eligibleForDisablePublic.length === 0}
                      size="sm"
                      variant="secondary"
                      title={eligibleForDisablePublic.length === 0 ? "All selected already private" : "Disable public"}
                    >
                      Disable Public
                    </Button> */}

                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Delete (confirm modal already wired) */}
                <Button
                  onClick={() => setIsAlertOpen(true)}
                  disabled={loading}
                  size="sm"
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>

              {/* Mobile actions: single trigger -> bottom sheet */}
              <div className="md:hidden ml-auto">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button size="sm" className="flex items-center gap-2">
                      <MoreHorizontal className="h-4 w-4" />
                      Bulk actions
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[70vh]">
                    <SheetHeader>
                      <SheetTitle>{selectedRows.length} selected</SheetTitle>
                    </SheetHeader>

                    <div className="mt-4 grid gap-2">
                      <Button
                        onClick={handleBatchDownload}
                        disabled={loading}
                        size="sm"
                        className="justify-start gap-2"
                      >
                        <QrCode className="h-4 w-4" /> QR Code
                      </Button>

                      <Button
                        onClick={() => handleBulkArchive(true)}
                        disabled={loading}
                        size="sm"
                        variant="destructive"
                        className="justify-start gap-2"
                      >
                        <Archive className="h-4 w-4" /> Archive selected
                      </Button>

                      <Button
                        onClick={() => handleBulkArchive(false)}
                        disabled={loading}
                        size="sm"
                        variant="outline"
                        className="justify-start gap-2"
                      >
                        <ArchiveRestore className="h-4 w-4" /> Unarchive selected
                      </Button>
                      <Button
                        onClick={() => handleBulkPublicToggle(true)}
                        disabled={loading || eligibleForEnablePublic.length === 0}
                        size="sm"
                        title={eligibleForEnablePublic.length === 0 ? "Already public or archived" : "Enable public"}
                      >
                        Enable Public
                      </Button>

                      <Button
                        onClick={() => handleBulkPublicToggle(false)}
                        disabled={loading || eligibleForDisablePublic.length === 0}
                        size="sm"
                        variant="secondary"
                        title={eligibleForDisablePublic.length === 0 ? "Already private or archived" : "Disable public"}
                      >
                        Disable Public
                      </Button>
                      <Button
                        onClick={() => setIsAlertOpen(true)}
                        disabled={loading}
                        size="sm"
                        variant="destructive"
                        className="justify-start gap-2"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                      {countArchived > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {countArchived} archived (public toggle disabled)
                        </span>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              <Sheet open={archiveSheetOpen} onOpenChange={setArchiveSheetOpen}>
  <SheetContent side="right" className="w-[400px]">
    <SheetHeader>
      <SheetTitle>Archive Employees</SheetTitle>
    </SheetHeader>

    <div className="mt-6 space-y-4">
      <p className="text-sm text-muted-foreground">
        Set termination date (optional). If not set, today will be used.
      </p>

      <input
        type="date"
        className="w-full border rounded-md px-3 py-2 text-sm"
        onChange={(e) => setTerminationDate(e.target.value)}
      />

      <Button
        className="w-full"
        disabled={loading}
        onClick={async () => {
          await handleArchiveWithDate();
        }}
      >
        Confirm Archive
      </Button>
    </div>
  </SheetContent>
</Sheet>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>

    
  );
}
