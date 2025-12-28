import React from "react";

type MetricChartProps = {
  metric: "height" | "weight";
  values: number[];
  labels: string[];
};

const width = 600;
const height = 240;
const padding = { top: 18, right: 24, bottom: 36, left: 52 };

export default function MetricChart({ metric, values, labels }: MetricChartProps) {
  if (!values.length) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted">
        기록이 없습니다.
      </div>
    );
  }

  let min = Math.min(...values);
  let max = Math.max(...values);
  let range = max - min;
  if (range === 0) {
    range = 1;
  }
  const pad = range * 0.2;
  min -= pad;
  max += pad;

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const xFor = (index: number) =>
    padding.left +
    (values.length === 1 ? plotWidth / 2 : (plotWidth * index) / (values.length - 1));
  const yFor = (value: number) =>
    padding.top + plotHeight * (1 - (value - min) / (max - min));

  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = min + ((max - min) * index) / 4;
    return { value, y: yFor(value) };
  });

  const pathD = values
    .map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(value)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="성장 추적 차트">
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

      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={height - padding.bottom}
        y2={height - padding.bottom}
        className="chart-axis"
      />

      <path
        d={pathD}
        className={`chart-line ${metric === "weight" ? "weight" : ""}`}
        pathLength={1}
      />

      {values.map((value, index) => (
        <circle
          key={`${metric}-${index}`}
          cx={xFor(index)}
          cy={yFor(value)}
          r={4}
          className="chart-dot"
          style={{ animationDelay: `${index * 0.08}s` }}
        />
      ))}

      {values.length >= 2 && (
        <>
          <text
            x={xFor(0)}
            y={height - 10}
            className="chart-label"
            textAnchor="start"
          >
            {labels[0]}
          </text>
          <text
            x={xFor(values.length - 1)}
            y={height - 10}
            className="chart-label"
            textAnchor="end"
          >
            {labels[values.length - 1]}
          </text>
        </>
      )}
    </svg>
  );
}
