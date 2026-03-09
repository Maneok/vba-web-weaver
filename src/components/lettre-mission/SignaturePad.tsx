import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Check, Pen } from "lucide-react";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel?: () => void;
  width?: number;
  height?: number;
  label?: string;
}

export default function SignaturePad({
  onSave,
  onCancel,
  width = 400,
  height = 200,
  label = "Signez ci-dessous",
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  // Setup canvas on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas resolution for retina displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Setup drawing style
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [width, height]);

  const getCoords = useCallback((e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasStrokes(true);
  }, [getCoords]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, getCoords]);

  const stopDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(false);
  }, []);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasStrokes(false);
  }, []);

  const handleValidate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  }, [onSave]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Pen className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">{label}</span>
      </div>

      <div
        className="border-2 border-dashed border-border rounded-xl overflow-hidden bg-white touch-none"
        style={{ width: Math.min(width, window.innerWidth - 48) }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair"
          style={{ width: "100%", height: `${height}px` }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Dessinez votre signature avec la souris ou le doigt (ecran tactile)
      </p>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleClear}
          className="gap-1.5 text-xs"
        >
          <Eraser className="w-3.5 h-3.5" />
          Effacer
        </Button>
        <Button
          size="sm"
          onClick={handleValidate}
          disabled={!hasStrokes}
          className="gap-1.5 text-xs"
        >
          <Check className="w-3.5 h-3.5" />
          Valider la signature
        </Button>
        {onCancel && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="text-xs"
          >
            Annuler
          </Button>
        )}
      </div>
    </div>
  );
}
