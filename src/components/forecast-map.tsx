"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { interpolateForecasts } from "@/lib/weather/interpolate";
import { degreesToCardinal } from "@/lib/weather/types";
import type { ForecastHour } from "@/lib/weather/types";
import { format } from "date-fns";

interface ForecastMapProps {
  spotId: number;
  lat: number;
  lng: number;
  hours: ForecastHour[];
  minWind?: number;
  maxWind?: number;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  direction: number,
  speed: number,
  minWind: number,
  maxWind: number,
) {
  const size = 24 + Math.min(speed / 35, 1) * 24;
  const rad = ((direction + 180) * Math.PI) / 180; // rotate: arrow points where wind blows TO

  // Color based on speed thresholds
  let color: string;
  if (speed < minWind) {
    color = "#22c55e"; // green
  } else if (speed <= maxWind) {
    color = "#eab308"; // yellow
  } else {
    color = "#ef4444"; // red
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad);

  // Drop shadow for visibility
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Arrow shaft
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(0, size / 2);
  ctx.lineTo(0, -size / 2);
  ctx.stroke();

  // Arrow head
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size / 2 - 8);
  ctx.lineTo(-10, -size / 2 + 6);
  ctx.lineTo(10, -size / 2 + 6);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export function ForecastMap({
  spotId,
  hours,
  minWind = 12,
  maxWind = 25,
}: ForecastMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Only interpolate the first 25 hours (24h window)
  const slice = useMemo(() => hours.slice(0, 25), [hours]);
  const interpolated = useMemo(
    () => interpolateForecasts(slice, 30),
    [slice],
  );
  const maxIndex = Math.max(interpolated.length - 1, 0);

  // Load satellite image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `/api/satellite/${spotId}`;
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      setImageError(true);
    };
  }, [spotId]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Draw satellite image
    if (imgRef.current && imageLoaded) {
      ctx.drawImage(imgRef.current, 0, 0, rect.width, rect.height);
    } else {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, rect.width, rect.height);
    }

    // Draw 3×3 grid of wind arrows
    if (interpolated.length > 0) {
      const point = interpolated[Math.min(sliderIndex, maxIndex)];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          drawArrow(
            ctx,
            (rect.width * (col + 1)) / 4,
            (rect.height * (row + 1)) / 4,
            point.windDirection,
            point.windSpeed,
            minWind,
            maxWind,
          );
        }
      }
    }
  }, [imageLoaded, interpolated, sliderIndex, maxIndex, minWind, maxWind]);

  useEffect(() => {
    draw();
  }, [draw]);

  // ResizeObserver for responsive canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  const current = interpolated[Math.min(sliderIndex, maxIndex)] ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wind Map</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={containerRef}
          className="relative w-full max-w-[600px] mx-auto aspect-[3/2] rounded-md overflow-hidden"
        >
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 bg-muted animate-pulse rounded-md" />
          )}
          {imageError && (
            <div className="absolute inset-0 bg-muted flex items-center justify-center text-muted-foreground text-sm">
              Satellite image unavailable
            </div>
          )}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        </div>

        {current && (
          <p className="text-sm text-center text-muted-foreground">
            {current.windSpeed.toFixed(1)} kt &middot;{" "}
            {degreesToCardinal(Math.round(current.windDirection))}{" "}
            ({Math.round(current.windDirection)}°) &middot; gusts{" "}
            {current.windGusts.toFixed(1)} kt
          </p>
        )}

        <div className="max-w-[600px] mx-auto space-y-1">
          <input
            type="range"
            min={0}
            max={maxIndex}
            value={sliderIndex}
            onChange={(e) => setSliderIndex(Number(e.target.value))}
            className="w-full accent-primary"
          />
          {current && (
            <p className="text-xs text-center text-muted-foreground">
              {format(current.time, "EEE HH:mm")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
