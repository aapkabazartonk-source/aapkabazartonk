"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Detector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onDetect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetect: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  const [message, setMessage] = useState("Point the camera at a barcode.");

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;

    const stop = () => {
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };

    const start = async () => {
      const DetectorCtor = (
        window as Window & {
          BarcodeDetector?: new (options?: { formats?: string[] }) => Detector;
        }
      ).BarcodeDetector;

      if (!DetectorCtor || !navigator.mediaDevices?.getUserMedia) {
        setMessage(
          "This browser cannot scan barcodes with the camera. Use a USB scanner or type the code.",
        );
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        let detector: Detector;
        try {
          detector = new DetectorCtor({
            formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"],
          });
        } catch {
          detector = new DetectorCtor();
        }

        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes.find((code) => code.rawValue)?.rawValue;
            if (value) {
              onDetectRef.current(value);
              onOpenChange(false);
              return;
            }
          } catch {
            // A frame can fail before the camera is ready.
          }
          frame = requestAnimationFrame(() => {
            void scan();
          });
        };
        void scan();
      } catch {
        setMessage("Camera permission was blocked. Allow camera access, or use a USB scanner.");
      }
    };

    void start();
    return stop;
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scan barcode</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <video ref={videoRef} className="aspect-video w-full rounded-xl bg-black object-cover" muted playsInline />
      </DialogContent>
    </Dialog>
  );
}
