"use client";

import { useState, useRef } from "react";
import { ScanLine } from "lucide-react";
import Modal from "./ui/modal";
import CameraScanner from "./camera";
import { Button } from "./ui/button";


const CameraScannerWrapper = () => {
  const [isOpen, setIsOpen] = useState(false);
  const scannerRef = useRef<{ startScan: () => void; stopScan: () => void } | null>(null);

  const handleOpen = async () => {
    try {
      // Prompt for permission explicitly on mobile
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setIsOpen(true);
    } catch (err) {
      alert("Camera permission is required to scan QR codes.");
      console.error("Camera permission error:", err);
    }
  };


  const handleClose = () => {
    setIsOpen(false);
    scannerRef.current?.stopScan();
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 sm:hidden">
        <button
          onClick={handleOpen}
          className="inline-flex items-center justify-center rounded-full bg-green-600 px-5 py-3 text-white shadow-lg ring-1 ring-green-600/60 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition"
          aria-label="Open Scanner"
        >
          <ScanLine className="h-6 w-6" />
          <span className="sr-only">Open QR Scanner</span>
        </button>
      </div>

      {/* Modal with Fullscreen Scanner */}
      <Modal
        title=""
        description=""
        isOpen={isOpen}
        onClose={handleClose}
      >
        
        <div className="fixed inset-0 z-50 bg-black sm:hidden">
          <CameraScanner ref={scannerRef} />
        </div>
        <div className="fixed inset-0 z-50 bg-black sm:hidden">
          {/* Close Button */}
          <Button
            size="icon"
            variant="destructive"
            onClick={handleClose}
            className="absolute top-4 right-4 z-50 p-2 rounded-full"
            aria-label="Close Scanner"
          >
            ✕
          </Button>

          <CameraScanner ref={scannerRef} />
        </div>
      </Modal>
    </>
  );
};

export default CameraScannerWrapper;
