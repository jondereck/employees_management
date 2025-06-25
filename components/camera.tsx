"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";

const CameraScanner = forwardRef((_, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserQRCodeReader | null>(null);
  const controlsRef = useRef<any>(null);
  const [scanning, setScanning] = useState(false);
  const [qrResult, setQrResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingCamera, setLoadingCamera] = useState(true);
  const [loadingRedirect, setLoadingRedirect] = useState(false);
  const [showScanningHint, setShowScanningHint] = useState(false);
  const [scanStartTime, setScanStartTime] = useState<number | null>(null);




  useEffect(() => {
    codeReader.current = new BrowserQRCodeReader();

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, []);


  const handleTryAgain = () => {
    setError(null);
    setQrResult(null);
    startScan();
  };

  const startScan = async () => {
    setError(null);
    setQrResult(null);
    setScanning(true);
    setLoadingCamera(true);
    setShowScanningHint(true); // show scanning hint when starting

    // Then after delay logic, add a timer to hide hint after a few seconds
    setTimeout(() => {
      setShowScanningHint(false); // hide after 5s or adjust as needed
    }, 5000);

    if (!videoRef.current || !codeReader.current) {
      setError("No video or QR code reader available");
      setScanning(false);
      setLoadingCamera(false);
      return;
    }

    try {
      const videoInputs = await BrowserQRCodeReader.listVideoInputDevices();

      let selectedDeviceId = videoInputs.find((device) =>
        device.label.toLowerCase().includes("back") ||
        device.label.toLowerCase().includes("rear")
      )?.deviceId;

      if (!selectedDeviceId && videoInputs.length > 0) {
        selectedDeviceId = videoInputs[0].deviceId;
      }

      if (!selectedDeviceId) {
        setError("No camera device found");
        setScanning(false);
        setLoadingCamera(false);
        return;
      }

      const now = Date.now();
      setScanStartTime(now);

      let scanSucceeded = false;

      const controls = await codeReader.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result, err) => {
          if (result) {
            const text = result.getText();
            if (text.startsWith("https://hrps.vercel.app/")) {
              scanSucceeded = true;
              controls.stop(); // stop only on valid code
       
              // setQrResult(text);
              setScanning(false);
              setLoadingRedirect(true);

              setTimeout(() => {
                window.location.href = text;
              }, 1500); // 1.5 seconds delay
            } else {
              setError("Scanned QR code is not from a trusted source.");
            }
          }

          if (err && !(err.name === "NotFoundException")) {
            const now = Date.now();
            const gracePeriod = 3000;

            if (!scanStartTime || now - scanStartTime > gracePeriod) {
              console.error("QR scan error:", err);
              setError("An error occurred while scanning.");
            } else {
              console.warn("Ignored early scan error:", err.message);
            }
          }

        }
      );

      controlsRef.current = controls;
      setLoadingCamera(false);
    } catch (e) {
      console.error("Camera error:", e);
      setError("Failed to access camera or scan QR code.");
      setScanning(false);
      setLoadingCamera(false);
    }
  };


  const stopScan = () => {
    controlsRef.current?.stop();
    setScanning(false);
  };

  // Expose start/stop to parent
  useImperativeHandle(ref, () => ({
    startScan,
    stopScan,
  }));

  useEffect(() => {
    startScan();
  }, []);



  return (
    <>
      {loadingCamera && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-20">
          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Fullscreen Scanner with Guide Box */}
      <div className="relative w-full h-full bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          autoPlay
        />
      </div>
      <div className="absolute inset-0 pointer-events-none">
        {/* Top overlay */}
        <div className="absolute top-0 left-0 right-0" style={{ height: '32%' }} >
          <div className="w-full h-full bg-black opacity-60" />
        </div>

        {/* Bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: '32%' }}>
          <div className="w-full h-full bg-black opacity-60" />
        </div>

        {/* Left overlay */}
        <div
          className="absolute"
          style={{
            top: '32%',
            bottom: '32%',
            left: 0,
            width: '12.5%',
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        />

        {/* Right overlay */}
        <div
          className="absolute"
          style={{
            top: '32%',
            bottom: '32%',
            right: 0,
            width: '12.5%',
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        />

        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-green-400 animate-scan" />
        </div>


        {/* Corner markers instead of full border */}
        <div className="absolute top-1/2 left-1/2 w-[60vw] h-[60vw] -translate-x-1/2 -translate-y-1/2 z-10">
          {/* Top-left */}
          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-500 rounded-tl-md" />
          {/* Top-right */}
          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-500 rounded-tr-md" />
          {/* Bottom-left */}
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-500 rounded-bl-md" />
          {/* Bottom-right */}
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-500 rounded-br-md" />
        </div>





        {/* Hint Text */}
        <p className="absolute text-center bottom-10 left-1/2 transform -translate-x-1/2 text-white text-sm z-20">
          Align the QR code within the box
        </p>
      </div>



      {/* QR Result message */}
      {qrResult && (
        <div className="fixed bottom-20 left-1/2 max-w-xs transform -translate-x-1/2 rounded-lg bg-white p-4 text-center text-sm font-medium text-gray-900 shadow-md ring-1 ring-gray-300 transition-opacity duration-300 z-50">
          {qrResult}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="fixed bottom-32 left-1/2 max-w-xs transform -translate-x-1/2 rounded-lg bg-red-50 p-4 text-center text-sm font-medium text-red-700 shadow-md ring-1 ring-red-200 transition-opacity duration-300 z-50">
          {error}
        </div>
      )}

      {error && (
        <div className="fixed bottom-32 left-1/2 max-w-xs transform -translate-x-1/2 rounded-lg bg-red-50 p-4 text-center text-sm font-medium text-red-700 shadow-md ring-1 ring-red-200 transition-opacity duration-300 z-50">
          <p>{error}</p>
          <button
            onClick={handleTryAgain}
            className="mt-2 inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-1.5 text-white text-xs font-medium hover:bg-red-700  hover:scale-105 transition-transform"
          >
            Try Again
          </button>
        </div>
      )}

      {loadingRedirect && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-70">
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm">Valid QR detected, redirecting...</p>
          </div>
        </div>
      )}


    </>
  );
});

CameraScanner.displayName = "CameraScanner";
export default CameraScanner;
