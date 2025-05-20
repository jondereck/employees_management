"use client";

import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { useRef, useState } from "react";
import { ActionTooltip } from "./ui/action-tooltip";


interface QrCodeGeneratorProps {
  departmentId: string;
  employeeId: string;
}


export const QrCodeGenerator: React.FC<QrCodeGeneratorProps> = ({
  departmentId,
  employeeId,
}) => {
  const qrValue = `${process.env.NEXT_PUBLIC_URL}/view/employee/${employeeId}`;
  const [isOpen, setIsOpen] = useState(false);
  const qrRef = useRef<HTMLCanvasElement | null>(null);
  // Handle modal toggle
  const handleOpen = () => setIsOpen(true);


  // Handle Download
  const handleDownload = () => {
    const canvas = qrRef.current;
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = `employee-${employeeId}-qr.png`;
      link.click();
    }
  };

  // Handle Print
  const handlePrint = () => {
    const canvas = qrRef.current;
    if (canvas) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        const imgData = canvas.toDataURL("image/png");
        printWindow.document.write(`<img src="${imgData}" onload="window.print(); window.close();" />`);
        printWindow.document.close();
      }
    }
  };

  return (
    <div>
      <ActionTooltip label="Click to enlarge" side="top" align="center">
        <div
          className="my-4 flex flex-col items-start space-y-2 cursor-pointer"
          onClick={handleOpen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleOpen()}
        >
          <QRCodeCanvas value={qrValue} size={100} />
        </div>
      </ActionTooltip>

      {/* Modal to show enlarged QR code */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-full max-w-sm p-6">
          <DialogHeader>
            <DialogTitle className="text-center">Employee QR Code</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              Scan the QR code or download it for reference.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center items-center py-6">
            <QRCodeCanvas value={qrValue} size={200} ref={qrRef} />
          </div>

          <DialogFooter className="flex justify-between items-center mt-4">
            <Button variant="outline" onClick={handleDownload}>⬇️ Download</Button>
            <Button variant="outline" onClick={handlePrint}>🖨️ Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
