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

  const askForCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop()); // stop it immediately
      console.log("Camera permission granted");
      startScan(); // ✅ Start scanner AFTER permission is granted
    } catch (err) {
      console.error("Camera permission denied", err);
      setError("Camera access denied. Please allow access to scan QR codes.");
    }
  };

  useEffect(() => {
    codeReader.current = new BrowserQRCodeReader();

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, []);

  const startScan = async () => {
    setError(null);
    setQrResult(null);
    setScanning(true);
    setLoadingCamera(true); // start loading spinner

    if (!videoRef.current || !codeReader.current) {
      setError("No video or QR code reader available");
      setScanning(false);
      setLoadingCamera(false); // stop loading here
      return;
    }

    try {
      const videoInputs = await BrowserQRCodeReader.listVideoInputDevices();

      // Try to find a rear camera
      let selectedDeviceId = videoInputs.find((device) =>
        device.label.toLowerCase().includes("back") ||
        device.label.toLowerCase().includes("rear")
      )?.deviceId;

      // If not found, just use the first one
      if (!selectedDeviceId && videoInputs.length > 0) {
        selectedDeviceId = videoInputs[0].deviceId;
      }


      if (!selectedDeviceId) {
        setError("No camera device found");
        setScanning(false);
        setLoadingCamera(false); // stop loading here
        return;
      }

      const controls = await codeReader.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result, err) => {
          if (result) {
            const text = result.getText();
            setQrResult(text);
            controls.stop();
            setScanning(false);

            if (text.startsWith("https://hrps.vercel.app/")) {
              setLoadingRedirect(true); // show spinner before navigation
              window.location.href = text;
            } else {
              alert("Scanned QR code is not from a trusted source.");
            }
          }

          if (err && !(err.name === "NotFoundException")) {
            console.error("QR scan error:", err);
          }
        }
      );

      controlsRef.current = controls;
      setLoadingCamera(false);  // stop loading here after camera started

    } catch (e) {
      setError("Failed to access camera or scan QR code.");
      setScanning(false);
      setLoadingCamera(false);  // stop loading here on error
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
        <div className="absolute top-0 left-0 right-0" style={{ height: '25%' }} >
          <div className="w-full h-full bg-black opacity-60" />
        </div>

        {/* Bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: '25%' }}>
          <div className="w-full h-full bg-black opacity-60" />
        </div>

        {/* Left overlay */}
        <div
          className="absolute"
          style={{
            top: '25%',
            bottom: '25%',
            left: 0,
            width: '12.5%',
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        />

        {/* Right overlay */}
        <div
          className="absolute"
          style={{
            top: '25%',
            bottom: '25%',
            right: 0,
            width: '12.5%',
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        />

        {/* Guide Box (centered) */}
        <div
          className="absolute border-4 border-green-500 rounded-md"
          style={{
            top: '25%',
            left: '12.5%',
            width: '75%',
            height: '50%',
            zIndex: 10,
          }}
        />

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

      {loadingRedirect && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-70">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

    </>
  );
});

CameraScanner.displayName = "CameraScanner";
export default CameraScanner;
