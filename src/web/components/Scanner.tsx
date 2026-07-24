import { useEffect, useRef, useState } from "react";

type Props = {
  onDetected: (barcode: string) => void;
  onClose: () => void;
};

type NativeDetector = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "itf"];

/**
 * Chrome exposes a native BarcodeDetector; Safari/iOS does not, so we lazily
 * pull in ZXing only on the browsers that need it.
 */
async function makeDetector(): Promise<NativeDetector> {
  const Native = (
    globalThis as unknown as {
      BarcodeDetector?: {
        new (options?: { formats: string[] }): NativeDetector;
        getSupportedFormats?: () => Promise<string[]>;
      };
    }
  ).BarcodeDetector;

  if (Native) {
    try {
      const supported = (await Native.getSupportedFormats?.()) ?? FORMATS;
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.length) return new Native({ formats });
    } catch {
      /* fall through to ZXing */
    }
  }

  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ]);

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.ITF,
  ]);
  const reader = new BrowserMultiFormatReader(hints);

  return {
    async detect(source) {
      const canvas = source as HTMLCanvasElement;
      try {
        const result = reader.decodeFromCanvas(canvas);
        return result ? [{ rawValue: result.getText() }] : [];
      } catch {
        return [];
      }
    },
  };
}

export function Scanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't use the camera. Enter the item by hand instead.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        setError("Camera access was blocked. Allow it in your browser settings, or type it in.");
        return;
      }

      const video = videoRef.current;
      if (!video || stopped) return;
      video.srcObject = stream;
      await video.play().catch(() => {});
      setReady(true);

      let detector: NativeDetector;
      try {
        detector = await makeDetector();
      } catch {
        setError("Couldn't start the scanner. Enter the item by hand instead.");
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });

      const tick = async () => {
        if (stopped || !video.videoWidth || !canvas || !ctx) {
          frame = requestAnimationFrame(tick);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          const results = await detector.detect(canvas);
          const hit = results.find((r) => /^\d{8,14}$/.test(r.rawValue.replace(/\D/g, "")));
          if (hit && !stopped) {
            stopped = true;
            navigator.vibrate?.(40);
            onDetected(hit.rawValue.replace(/\D/g, ""));
            return;
          }
        } catch {
          /* keep scanning */
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-white">
        <button onClick={onClose} className="h-11 px-3 text-sm font-medium">
          Cancel
        </button>
        <span className="text-sm font-semibold">Scan the barcode</span>
        <span className="w-16" />
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-72 rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
          </div>
        )}

        <p className="absolute inset-x-0 bottom-6 px-8 text-center text-sm text-white/90">
          {error || (ready ? "Line the barcode up inside the box" : "Starting the camera…")}
        </p>
      </div>

      {error && (
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={onClose}
            className="min-h-[48px] w-full rounded-xl bg-white font-semibold text-black"
          >
            Enter it by hand
          </button>
        </div>
      )}
    </div>
  );
}
