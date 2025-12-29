import React from "react";

export type ReferenceCurve = {
  key: string;
  points: { x: number; y: number }[];
};

export type ChartEvent = {
  x: number;
  label: string;
  type: "growth" | "suppression";
  offset?: number;
};

type MetricChartProps = {
  metric: "height" | "weight";
  values: number[];
  labels: string[];
  xValues?: number[];
  xRange?: { min: number; max: number };
  referenceCurves?: ReferenceCurve[];
  highlightPoint?: { x: number; y: number };
  events?: ChartEvent[];
  xLabelFormatter?: (value: number) => string;
  className?: string;
};

const width = 600;
const height = 240;
const padding = { top: 18, right: 24, bottom: 36, left: 52 };

export default function MetricChart({
  metric,
  values,
  labels,
  xValues,
  xRange,
  referenceCurves,
  highlightPoint,
  events,
  xLabelFormatter,
  className
}: MetricChartProps) {
  const points = values
    .map((value, index) => ({
      x: xValues ? xValues[index] : index,
      y: value
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  const referencePoints = (referenceCurves ?? []).flatMap((curve) => curve.points);
  const hasHighlight =
    Boolean(highlightPoint) &&
    Number.isFinite(highlightPoint?.x) &&
    Number.isFinite(highlightPoint?.y);
  const hasRenderableData = points.length > 0 || referencePoints.length > 0 || hasHighlight;

  if (!hasRenderableData) {
    return (
      <div
        className={`flex h-[200px] w-full items-center justify-center text-sm text-muted ${className ?? ""}`}
      >
        기록이 없습니다.
      </div>
    );
  }

  const allX = [
    ...points.map((point) => point.x),
    ...referencePoints.map((point) => point.x),
    highlightPoint?.x,
    ...(events ?? []).map((event) => event.x)
  ].filter((value): value is number => Number.isFinite(value));
  const allY = [
    ...points.map((point) => point.y),
    ...referencePoints.map((point) => point.y),
    highlightPoint?.y
  ].filter((value): value is number => Number.isFinite(value));

  let xMin = xRange?.min ?? Math.min(...allX);
  let xMax = xRange?.max ?? Math.max(...allX);
  if (xMax === xMin) {
    xMax = xMin + 1;
  }

  let min = Math.min(...allY);
  let max = Math.max(...allY);
  let range = max - min;
  if (range === 0) {
    range = 1;
  }
  const pad = range * 0.18;
  min -= pad;
  max += pad;

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const xFor = (value: number) =>
    padding.left + ((value - xMin) / (xMax - xMin)) * plotWidth;
  const yFor = (value: number) =>
    padding.top + plotHeight * (1 - (value - min) / (max - min));

  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = min + ((max - min) * index) / 4;
    return { value, y: yFor(value) };
  });

  const pathD = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(point.x)} ${yFor(point.y)}`)
    .join(" ");

  const curvePaths = (referenceCurves ?? [])
    .map((curve) => {
      const filtered = curve.points.filter(
        (point) => point.x >= xMin && point.x <= xMax && Number.isFinite(point.y)
      );
      if (!filtered.length) {
        return null;
      }
      const d = filtered
        .map(
          (point, index) => `${index === 0 ? "M" : "L"} ${xFor(point.x)} ${yFor(point.y)}`
        )
        .join(" ");
      return { key: curve.key, d };
    })
    .filter((curve): curve is { key: string; d: string } => Boolean(curve));

  const axisY = height - padding.bottom;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="성장 추적 차트"
      preserveAspectRatio="xMidYMid meet"
      className={`w-full h-auto ${className ?? ""}`}
    >
      {grid.map((row) => (
        <g key={`grid-${row.y}`}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={row.y}
            y2={row.y}
            className="chart-grid"
          />
          <text
            x={padding.left - 10}
            y={row.y + 4}
            className="chart-label"
            textAnchor="end"
          >
            {row.value.toFixed(1)}
          </text>
        </g>
      ))}

      {curvePaths.map((curve) => {
        const curveClass =
          curve.key === "50th"
            ? "chart-percentile major"
            : curve.key === "3rd" || curve.key === "97th"
            ? "chart-percentile mid"
            : "chart-percentile";
        return <path key={`curve-${curve.key}`} d={curve.d} className={curveClass} />;
      })}

      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={axisY}
        y2={axisY}
        className="chart-axis"
      />

      {points.length > 0 && (
        <path
          d={pathD}
          className={`chart-line ${metric === "weight" ? "weight" : ""}`}
          pathLength={1}
        />
      )}

      {points.map((point, index) => (
        <circle
          key={`${metric}-${index}`}
          cx={xFor(point.x)}
          cy={yFor(point.y)}
          r={4}
          className="chart-dot"
          style={{ animationDelay: `${index * 0.08}s` }}
        />
      ))}

      {highlightPoint && (
        <circle
          cx={xFor(highlightPoint.x)}
          cy={yFor(highlightPoint.y)}
          r={5.2}
          className="chart-current"
        />
      )}

      {events?.map((event, index) => {
        const arrowSize = 6;
        const x = xFor(event.x) + (event.offset ?? 0);
        const baseY = axisY - 6;
        const points =
          event.type === "growth"
            ? `${x},${baseY - arrowSize} ${x - arrowSize},${baseY + arrowSize} ${
                x + arrowSize
              },${baseY + arrowSize}`
            : `${x},${baseY + arrowSize} ${x - arrowSize},${baseY - arrowSize} ${
                x + arrowSize
              },${baseY - arrowSize}`;
        const labelY = baseY - arrowSize - 6;
        return (
          <g
            key={`event-${index}`}
            className={event.type === "growth" ? "chart-event-growth" : "chart-event-suppression"}
          >
            <polygon points={points} className="chart-event" />
            <text x={x} y={labelY} className="chart-event-label" textAnchor="middle">
              {event.label}
            </text>
          </g>
        );
      })}

      {(xLabelFormatter || labels.length >= 2) && (
        <>
          <text
            x={padding.left}
            y={height - 10}
            className="chart-label"
            textAnchor="start"
          >
            {xLabelFormatter ? xLabelFormatter(xMin) : labels[0]}
          </text>
          <text
            x={width - padding.right}
            y={height - 10}
            className="chart-label"
            textAnchor="end"
          >
            {xLabelFormatter ? xLabelFormatter(xMax) : labels[labels.length - 1]}
          </text>
        </>
      )}
    </svg>
  );
}
