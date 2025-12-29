import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

type MetricType = "height" | "weight";

type GrowthCurve = {
  ages: number[];
  percentiles: Record<string, number[]>;
};

type GrowthTableResponse = {
  metric: MetricType;
  percentiles: string[];
  bySex: Record<string, GrowthCurve>;
};

const FILES: Record<MetricType, string> = {
  height: "korea-growth-table_height.csv",
  weight: "korea-growth-table_weight.csv"
};

const percentilePattern = /^\d+(st|nd|rd|th)$/i;
const cache = new Map<MetricType, GrowthTableResponse>();

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseGrowthCsv(content: string) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 3) {
    return { percentiles: [], bySex: {} as Record<string, GrowthCurve> };
  }

  const headerTop = parseCsvLine(lines[0]).map((value, index) =>
    index === 0 ? value.replace(/^\uFEFF/, "") : value
  );
  const headerBottom = parseCsvLine(lines[1]);
  const columns = headerTop.map((value, index) => {
    const bottom = headerBottom[index]?.trim();
    return bottom || value.trim();
  });

  const sexIndex = columns.findIndex((name) => name === "성별");
  const monthIndex = columns.findIndex((name) => name.includes("만나이(개월"));
  if (sexIndex < 0 || monthIndex < 0) {
    return { percentiles: [], bySex: {} as Record<string, GrowthCurve> };
  }

  const percentileColumns = columns
    .map((name, index) => ({ name: name.trim(), index }))
    .filter((column) => percentilePattern.test(column.name));

  const bySex = new Map<string, GrowthCurve>();

  lines.slice(2).forEach((line) => {
    const cells = parseCsvLine(line);
    const sexValue = Number.parseInt(cells[sexIndex], 10);
    const monthValue = Number.parseInt(cells[monthIndex], 10);

    if (!Number.isFinite(sexValue) || !Number.isFinite(monthValue)) {
      return;
    }

    const key = String(sexValue);
    let entry = bySex.get(key);
    if (!entry) {
      entry = {
        ages: [],
        percentiles: Object.fromEntries(
          percentileColumns.map((column) => [column.name, [] as number[]])
        )
      };
      bySex.set(key, entry);
    }

    entry.ages.push(monthValue);
    percentileColumns.forEach((column) => {
      const rawValue = cells[column.index];
      const parsed = Number.parseFloat(rawValue);
      entry?.percentiles[column.name].push(Number.isFinite(parsed) ? parsed : Number.NaN);
    });
  });

  return {
    percentiles: percentileColumns.map((column) => column.name),
    bySex: Object.fromEntries(bySex.entries())
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const metric = searchParams.get("metric");

  if (metric !== "height" && metric !== "weight") {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  }

  const cached = cache.get(metric);
  if (cached) {
    return NextResponse.json(cached);
  }

  const filePath = path.join(process.cwd(), FILES[metric]);
  const content = await fs.readFile(filePath, "utf8");
  const parsed = parseGrowthCsv(content);

  const response: GrowthTableResponse = {
    metric,
    percentiles: parsed.percentiles,
    bySex: parsed.bySex
  };

  cache.set(metric, response);
  return NextResponse.json(response);
}
