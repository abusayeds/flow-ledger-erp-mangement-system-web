import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import type { BarcodeConfig } from "./types";

type Props = {
  value: string;
  config?: Pick<BarcodeConfig, "barcodeType" | "text" | "barWidth" | "barHeight">;
  height?: number;
  displayValue?: boolean;
  className?: string;
};

const formatMap: Record<string, string> = {
  CODE128: "CODE128",
  CODE39: "CODE39",
  EAN13: "EAN13",
  EAN8: "EAN8",
  UPC: "UPC",
};

export const BarcodeSvg: React.FC<Props> = ({
  value,
  config,
  height,
  displayValue,
  className,
}) => {
  const ref = useRef<SVGSVGElement>(null);
  const text = (value || "").trim() || "SKU";
  const showText = displayValue ?? config?.text !== "Hide";
  const barH = height ?? Math.min(80, Math.max(40, (config?.barHeight ?? 140) / 2.5));
  const moduleWidth = Number.parseFloat(config?.barWidth || "2") || 2;

  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, text, {
        format: formatMap[config?.barcodeType || "CODE128"] || "CODE128",
        displayValue: showText,
        height: barH,
        width: Math.max(1, moduleWidth * 0.9),
        margin: 4,
        background: "#ffffff",
        lineColor: "#111111",
        fontSize: 12,
        textMargin: 4,
      });
    } catch {
      // Invalid value for chosen symbology — leave empty svg
      while (ref.current.firstChild) ref.current.removeChild(ref.current.firstChild);
    }
  }, [text, showText, barH, moduleWidth, config?.barcodeType]);

  return <svg ref={ref} className={className} />;
};

export const BarcodeLabelCard: React.FC<{
  header: string;
  sku: string;
  line1: string;
  line2?: string;
  config?: BarcodeConfig;
  className?: string;
  light?: boolean;
}> = ({ header, sku, line1, line2, config, className = "", light }) => {
  const align =
    config?.textAlignment === "Left"
      ? "text-left"
      : config?.textAlignment === "Right"
        ? "text-right"
        : "text-center";
  const barAlign =
    config?.barcodeAlignment === "Left"
      ? "justify-start"
      : config?.barcodeAlignment === "Right"
        ? "justify-end"
        : "justify-center";
  const font =
    config?.fontSize === "Small"
      ? "text-xs"
      : config?.fontSize === "Large"
        ? "text-base"
        : "text-sm";

  return (
    <div
      className={`rounded-md border p-3 ${light ? "bg-white border-gray-200 text-gray-900" : "bg-gray-50 border-gray-200 text-gray-900"} ${align} ${font} ${className}`}
    >
      {header ? <div className="font-semibold mb-2 truncate">{header}</div> : null}
      <div className={`flex ${barAlign} bg-white rounded px-1 py-1`}>
        <BarcodeSvg value={sku} config={config} height={light ? 56 : 48} displayValue={false} />
      </div>
      {sku ? <div className="mt-1.5 text-xs tracking-wide">{sku}</div> : null}
      {line1 ? <div className="mt-0.5 font-medium">{line1}</div> : null}
      {line2 ? <div className="mt-0.5 text-xs text-gray-600">{line2}</div> : null}
    </div>
  );
};
