import React, { useRef, useState, useEffect, useCallback } from "react";
import { RotateCcw, Upload } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import { todayIso } from "@/lib/dateIso";

interface SignatureModalProps {
  onClose: () => void;
  /** dialog heading — e.g. "Company Signature" / "Customer Signature" */
  heading?: string;
  /** prefill the Name field (contact person) */
  defaultName?: string;
  /** existing signature image URL or data URL (edit mode) */
  initialImage?: string;
  /** label next to authorized checkbox */
  authorizedLabel?: string;
  /** called on Done with the drawn signature + fields */
  onDone?: (data: { image: string; name: string; title: string; date: string }) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  onClose,
  heading = "Signature",
  defaultName = "",
  initialImage = "",
  authorizedLabel = "Authorized Signatory",
  onDone,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [name, setName] = useState(defaultName);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => todayIso());
  const [authorizedSig, setAuthorizedSig] = useState(authorizedLabel);
  const [authorizedChecked, setAuthorizedChecked] = useState(true);
  const [penColor, setPenColor] = useState("#000000");
  const [thickness, setThickness] = useState(2);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const done = () => {
    const image = canvasRef.current?.toDataURL("image/png") || "";
    onDone?.({ image, name, title, date });
    onClose();
  };

  const paintImage = (src: string) => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width - img.width * scale) / 2;
      const y = (canvas.height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    };
    img.src = src;
  };

  /* init canvas (+ optional existing image for edit) */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (initialImage) paintImage(initialImage);
  }, [initialImage]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e, canvas);
  }, []);

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      e.preventDefault();
      const pos = getPos(e, canvas);
      if (lastPos.current) {
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = penColor;
        ctx.lineWidth = thickness;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      }
      lastPos.current = pos;
    },
    [isDrawing, penColor, thickness]
  );

  const stopDraw = useCallback(() => {
    setIsDrawing(false);
    lastPos.current = null;
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
          const x = (canvas.width - img.width * scale) / 2;
          const y = (canvas.height - img.height * scale) / 2;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{heading}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={clearCanvas}
              className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900 px-1">
              Cancel
            </button>
            <button
              onClick={done}
              className="px-5 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="px-5 pt-4 space-y-3">
          {/* Name */}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
          />
          {/* Title + Date */}
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
            />
            <AppDatePicker
              value={date}
              onValueChange={setDate}
              placeholder="Date*"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
            />
          </div>

          {/* Authorized Signature row */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={authorizedChecked}
              onChange={(e) => setAuthorizedChecked(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600 cursor-pointer flex-shrink-0"
            />
            <input
              type="text"
              value={authorizedSig}
              onChange={(e) => setAuthorizedSig(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Canvas */}
        <div className="px-5 pt-3">
          <canvas
            ref={canvasRef}
            width={560}
            height={200}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
            className="w-full rounded-lg border border-gray-200 cursor-crosshair touch-none"
            style={{ height: "180px" }}
          />
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center gap-3 px-5 py-4">
          {/* Color picker */}
          <label className="cursor-pointer flex-shrink-0">
            <div
              className="w-9 h-9 rounded border border-gray-400"
              style={{ backgroundColor: penColor }}
            />
            <input
              type="color"
              value={penColor}
              onChange={(e) => setPenColor(e.target.value)}
              className="sr-only"
            />
          </label>

          {/* Thickness label */}
          <span className="text-sm text-gray-700 flex-shrink-0">Thickness</span>

          {/* Slider */}
          <input
            type="range"
            min={1}
            max={10}
            value={thickness}
            onChange={(e) => setThickness(Number(e.target.value))}
            className="flex-1 accent-blue-600 cursor-pointer"
          />

          {/* Upload */}
          <button
            onClick={handleUpload}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 flex-shrink-0"
            title="Upload signature image"
          >
            <Upload className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
