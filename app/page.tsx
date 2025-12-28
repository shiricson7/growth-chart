"use client";

import { useMemo, useState } from "react";
import MetricChart from "../components/MetricChart";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

type StatusType = "info" | "error" | "warn" | "success";

type Status = {
  message: string;
  type: StatusType;
};

type Patient = {
  id: string;
  name: string;
  residentId: string;
  chartNo: string | null;
};

type Visit = {
  id: string;
  date: string;
  height: number;
  weight: number;
  bmi: number;
  ageMonths: number;
};

type AgeInfo = {
  birth: Date;
  ageMonths: number;
};

const centuryMap: Record<string, number> = {
  "1": 1900,
  "2": 1900,
  "3": 2000,
  "4": 2000,
  "5": 1900,
  "6": 1900,
  "7": 2000,
  "8": 2000
};

const defaultStatus: Status = {
  message: "입력 후 저장하면 성장상태가 계산됩니다.",
  type: "info"
};

const statusStyles: Record<StatusType, string> = {
  info: "bg-accent2/10 text-muted",
  error: "bg-red-100 text-red-700",
  warn: "bg-amber-100 text-amber-800",
  success: "bg-emerald-100 text-emerald-800"
};

function normalizeResidentId(value: string) {
  return value.replace(/\D/g, "");
}

function parseResidentId(value: string): AgeInfo | null {
  const digits = normalizeResidentId(value);
  if (digits.length !== 13) {
    return null;
  }

  const yy = Number.parseInt(digits.slice(0, 2), 10);
  const mm = Number.parseInt(digits.slice(2, 4), 10);
  const dd = Number.parseInt(digits.slice(4, 6), 10);
  const genderCode = digits[6];
  const century = centuryMap[genderCode];

  if (!century || mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return null;
  }

  const year = century + yy;
  const birth = new Date(year, mm - 1, dd);
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== mm - 1 ||
    birth.getDate() !== dd
  ) {
    return null;
  }

  const now = new Date();
  let ageMonths = (now.getFullYear() - year) * 12 + (now.getMonth() - (mm - 1));
  if (now.getDate() < dd) {
    ageMonths -= 1;
  }

  if (ageMonths < 0) {
    return null;
  }

  return { birth, ageMonths };
}

function formatAge(ageMonths: number) {
  if (ageMonths < 24) {
    return `${ageMonths}개월`;
  }
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  return months === 0 ? `${years}년` : `${years}년 ${months}개월`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit"
  });
}

function maskResidentId(value: string) {
  const digits = normalizeResidentId(value);
  if (digits.length < 7) {
    return value;
  }
  return `${digits.slice(0, 6)}-${digits[6]}******`;
}

function bmiStatus(bmi: number) {
  if (bmi < 18.5) {
    return "낮음";
  }
  if (bmi < 23) {
    return "보통";
  }
  if (bmi < 25) {
    return "높음";
  }
  return "주의";
}

function diffDays(from: string, to: string) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

function toNumber(value: number | string | null) {
  if (value === null || value === undefined) {
    return 0;
  }
  return typeof value === "number" ? value : Number.parseFloat(value);
}

export default function Home() {
  const [form, setForm] = useState({
    name: "",
    residentId: "",
    chartNo: "",
    height: "",
    weight: ""
  });
  const [status, setStatus] = useState<Status>(defaultStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [currentVisit, setCurrentVisit] = useState<Visit | null>(null);
  const [previousVisit, setPreviousVisit] = useState<Visit | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);

  const ageInfo = useMemo(() => parseResidentId(form.residentId), [form.residentId]);
  const ageLabel = ageInfo ? formatAge(ageInfo.ageMonths) : "";
  const ageBucket = ageInfo
    ? ageInfo.ageMonths < 36
      ? "36개월 미만"
      : "36개월 이상"
    : "";

  const chartLabels = useMemo(() => visits.map((visit) => formatShortDate(visit.date)), [visits]);
  const heightValues = useMemo(() => visits.map((visit) => visit.height), [visits]);
  const weightValues = useMemo(() => visits.map((visit) => visit.weight), [visits]);

  const historyVisits = useMemo(() => {
    return [...visits]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [visits]);

  const handleResidentChange = (value: string) => {
    setForm((prev) => ({ ...prev, residentId: value }));

    if (!value.trim()) {
      setStatus(defaultStatus);
      return;
    }

    const parsed = parseResidentId(value);
    if (!parsed) {
      setStatus({ message: "주민등록번호 형식을 확인해주세요.", type: "error" });
      return;
    }

    const label = formatAge(parsed.ageMonths);
    setStatus({ message: `${label} · ${parsed.ageMonths < 36 ? "36개월 미만" : "36개월 이상"}`, type: "info" });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = form.name.trim();
    const residentRaw = form.residentId.trim();
    const chartNo = form.chartNo.trim();
    const height = Number.parseFloat(form.height);
    const weight = Number.parseFloat(form.weight);

    if (!name || !residentRaw || Number.isNaN(height) || Number.isNaN(weight)) {
      setStatus({ message: "모든 필수 항목을 입력해주세요.", type: "error" });
      return;
    }

    const parsed = parseResidentId(residentRaw);
    if (!parsed) {
      setStatus({ message: "주민등록번호를 정확히 입력해주세요.", type: "error" });
      return;
    }

    if (!isSupabaseConfigured) {
      setStatus({ message: "Supabase 환경 변수를 설정해주세요.", type: "error" });
      return;
    }

    setIsLoading(true);

    try {
      const residentId = normalizeResidentId(residentRaw);

      const { data: residentMatch, error: residentError } = await supabase
        .from("patients")
        .select("id, name, resident_id, chart_no")
        .eq("resident_id", residentId)
        .maybeSingle();

      if (residentError) {
        throw residentError;
      }

      let patientRow = residentMatch;
      let matchType: "resident" | "chart" | null = residentMatch ? "resident" : null;

      if (!patientRow && chartNo) {
        const { data: chartMatch, error: chartError } = await supabase
          .from("patients")
          .select("id, name, resident_id, chart_no")
          .eq("chart_no", chartNo)
          .maybeSingle();

        if (chartError) {
          throw chartError;
        }

        if (chartMatch) {
          patientRow = chartMatch;
          matchType = "chart";
        }
      }

      if (!patientRow) {
        const { data: createdPatient, error: insertError } = await supabase
          .from("patients")
          .insert({ name, resident_id: residentId, chart_no: chartNo || null })
          .select("id, name, resident_id, chart_no")
          .single();

        if (insertError || !createdPatient) {
          throw insertError;
        }

        patientRow = createdPatient;
      } else {
        const updates: { name?: string; chart_no?: string | null } = {};
        if (name && patientRow.name !== name) {
          updates.name = name;
        }
        if (chartNo && patientRow.chart_no !== chartNo) {
          updates.chart_no = chartNo;
        }

        if (Object.keys(updates).length) {
          const { data: updatedPatient, error: updateError } = await supabase
            .from("patients")
            .update(updates)
            .eq("id", patientRow.id)
            .select("id, name, resident_id, chart_no")
            .single();

          if (updateError || !updatedPatient) {
            throw updateError;
          }

          patientRow = updatedPatient;
        }
      }

      const { data: previousRows, error: previousError } = await supabase
        .from("visits")
        .select("id, height_cm, weight_kg, bmi, age_months, created_at")
        .eq("patient_id", patientRow.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (previousError) {
        throw previousError;
      }

      const previous = previousRows && previousRows[0]
        ? {
            id: previousRows[0].id,
            date: previousRows[0].created_at,
            height: toNumber(previousRows[0].height_cm),
            weight: toNumber(previousRows[0].weight_kg),
            bmi: toNumber(previousRows[0].bmi),
            ageMonths: previousRows[0].age_months
          }
        : null;

      const bmi = weight / Math.pow(height / 100, 2);

      const { data: newVisit, error: visitError } = await supabase
        .from("visits")
        .insert({
          patient_id: patientRow.id,
          height_cm: height,
          weight_kg: weight,
          bmi,
          age_months: parsed.ageMonths
        })
        .select("id, height_cm, weight_kg, bmi, age_months, created_at")
        .single();

      if (visitError || !newVisit) {
        throw visitError;
      }

      const { data: visitRows, error: visitRowsError } = await supabase
        .from("visits")
        .select("id, height_cm, weight_kg, bmi, age_months, created_at")
        .eq("patient_id", patientRow.id)
        .order("created_at", { ascending: true });

      if (visitRowsError) {
        throw visitRowsError;
      }

      const mappedVisits = (visitRows ?? []).map((row) => ({
        id: row.id,
        date: row.created_at,
        height: toNumber(row.height_cm),
        weight: toNumber(row.weight_kg),
        bmi: toNumber(row.bmi),
        ageMonths: row.age_months
      }));

      const mappedPatient: Patient = {
        id: patientRow.id,
        name: patientRow.name,
        residentId: patientRow.resident_id,
        chartNo: patientRow.chart_no
      };

      const mappedCurrent: Visit = {
        id: newVisit.id,
        date: newVisit.created_at,
        height: toNumber(newVisit.height_cm),
        weight: toNumber(newVisit.weight_kg),
        bmi: toNumber(newVisit.bmi),
        ageMonths: newVisit.age_months
      };

      setCurrentPatient(mappedPatient);
      setCurrentVisit(mappedCurrent);
      setPreviousVisit(previous);
      setVisits(mappedVisits);

      if (matchType === "chart" && patientRow.resident_id !== residentId) {
        setStatus({
          message: "차트번호가 기존 환자와 연결됩니다. 주민등록번호를 확인해주세요.",
          type: "warn"
        });
      } else {
        setStatus({ message: "성장 기록이 저장되었습니다.", type: "success" });
      }
    } catch (error) {
      setStatus({ message: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setForm({ name: "", residentId: "", chartNo: "", height: "", weight: "" });
    setStatus(defaultStatus);
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-6 pb-20 pt-10">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <span className="text-xs uppercase tracking-[0.3em] text-accent2">Growth Tracker</span>
          <h1 className="mt-2 text-4xl font-semibold text-ink">성장 추적기</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            방문 기록을 기반으로 현재 성장상태와 지난 방문 대비 변화량을 확인합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print rounded-full border border-outline px-5 py-2 text-sm font-medium text-ink transition hover:-translate-y-0.5"
        >
          출력
        </button>
      </header>

      <main className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="card frost animate-[rise_0.7s_ease] p-6 lg:col-span-5">
          <h2 className="text-xl font-semibold">방문 정보 입력</h2>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-muted">
                이름
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                  className="mt-2 w-full rounded-xl border border-outline bg-white/80 px-3 py-2 text-base text-ink outline-none focus:border-accent2"
                  placeholder="홍길동"
                />
              </label>
              <label className="text-sm text-muted">
                주민등록번호
                <input
                  value={form.residentId}
                  onChange={(event) => handleResidentChange(event.target.value)}
                  required
                  inputMode="numeric"
                  className="mt-2 w-full rounded-xl border border-outline bg-white/80 px-3 py-2 text-base text-ink outline-none focus:border-accent2"
                  placeholder="YYMMDD-XXXXXXX"
                />
              </label>
              <label className="text-sm text-muted">
                차트번호 (선택)
                <input
                  value={form.chartNo}
                  onChange={(event) => setForm((prev) => ({ ...prev, chartNo: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-outline bg-white/80 px-3 py-2 text-base text-ink outline-none focus:border-accent2"
                  placeholder="CH-2025-001"
                />
              </label>
              <label className="text-sm text-muted">
                자동 계산된 나이
                <input
                  value={ageLabel}
                  readOnly
                  className="mt-2 w-full rounded-xl border border-outline bg-white/80 px-3 py-2 text-base text-ink"
                  placeholder="주민등록번호 입력"
                />
              </label>
              <label className="text-sm text-muted">
                키 (cm)
                <input
                  type="number"
                  min="30"
                  max="220"
                  step="0.1"
                  value={form.height}
                  onChange={(event) => setForm((prev) => ({ ...prev, height: event.target.value }))}
                  required
                  className="mt-2 w-full rounded-xl border border-outline bg-white/80 px-3 py-2 text-base text-ink outline-none focus:border-accent2"
                  placeholder="100.5"
                />
              </label>
              <label className="text-sm text-muted">
                몸무게 (kg)
                <input
                  type="number"
                  min="2"
                  max="200"
                  step="0.1"
                  value={form.weight}
                  onChange={(event) => setForm((prev) => ({ ...prev, weight: event.target.value }))}
                  required
                  className="mt-2 w-full rounded-xl border border-outline bg-white/80 px-3 py-2 text-base text-ink outline-none focus:border-accent2"
                  placeholder="15.2"
                />
              </label>
            </div>

            <div className={`rounded-2xl px-4 py-3 text-sm ${statusStyles[status.type]}`}>
              {status.message}
            </div>

            {!isSupabaseConfigured && (
              <div className="text-xs text-red-600">
                Supabase 환경 변수가 필요합니다. `.env.local`을 설정해주세요.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-full bg-accent px-6 py-2 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? "저장 중..." : "저장 / 업데이트"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-outline px-5 py-2 text-sm text-ink transition hover:-translate-y-0.5"
              >
                입력 지우기
              </button>
            </div>
          </form>
        </section>

        <section className="card frost animate-[rise_0.85s_ease] p-6 lg:col-span-7">
          <h2 className="text-xl font-semibold">현재 성장상태</h2>
          {currentPatient && currentVisit ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                { label: "환자명", value: currentPatient.name },
                { label: "나이", value: formatAge(currentVisit.ageMonths) },
                { label: "키", value: `${currentVisit.height.toFixed(1)} cm` },
                { label: "몸무게", value: `${currentVisit.weight.toFixed(1)} kg` },
                { label: "BMI(참고)", value: `${currentVisit.bmi.toFixed(1)} · ${bmiStatus(currentVisit.bmi)}` },
                { label: "구분", value: currentVisit.ageMonths < 36 ? "36개월 미만" : "36개월 이상" },
                { label: "차트번호", value: currentPatient.chartNo || "—" },
                { label: "주민등록번호", value: maskResidentId(currentPatient.residentId) }
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-outline/60 bg-white/70 p-4">
                  <span className="text-xs text-muted">{item.label}</span>
                  <strong className="mt-1 block text-lg text-ink">{item.value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              입력값을 저장하면 현재 성장상태가 표시됩니다.
            </p>
          )}
        </section>

        <section className="card frost animate-[rise_1s_ease] p-6 lg:col-span-5">
          <h2 className="text-xl font-semibold">지난 방문과의 변화</h2>
          {currentVisit && previousVisit ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {(() => {
                const heightDiff = currentVisit.height - previousVisit.height;
                const weightDiff = currentVisit.weight - previousVisit.weight;
                const items = [
                  {
                    label: "키 변화",
                    value: `${heightDiff >= 0 ? "+" : ""}${heightDiff.toFixed(1)} cm`,
                    trend: heightDiff >= 0 ? "up" : "down"
                  },
                  {
                    label: "몸무게 변화",
                    value: `${weightDiff >= 0 ? "+" : ""}${weightDiff.toFixed(1)} kg`,
                    trend: weightDiff >= 0 ? "up" : "down"
                  },
                  { label: "지난 방문일", value: formatDate(previousVisit.date), trend: "neutral" },
                  {
                    label: "경과 일수",
                    value: `${diffDays(previousVisit.date, currentVisit.date)}일`,
                    trend: "neutral"
                  }
                ];

                return items.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-outline/60 bg-white/70 p-4">
                    <span className="text-xs text-muted">{item.label}</span>
                    <strong
                      className={`mt-1 block text-lg ${
                        item.trend === "up"
                          ? "text-emerald-600"
                          : item.trend === "down"
                          ? "text-rose-600"
                          : "text-ink"
                      }`}
                    >
                      {item.value}
                    </strong>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              지난 방문 기록이 있으면 변화량이 표시됩니다.
            </p>
          )}
        </section>

        <section className="card frost animate-[rise_1.15s_ease] p-6 lg:col-span-7">
          <h2 className="text-xl font-semibold">성장 차트</h2>
          {!currentVisit && (
            <p className="mt-4 text-sm text-muted">
              입력값을 저장하면 나이에 맞는 차트가 표시됩니다.
            </p>
          )}

          <div className={`mt-5 space-y-5 ${currentVisit && currentVisit.ageMonths < 36 ? "block" : "hidden"}`}>
            <div>
              <h3 className="text-lg font-semibold">36개월 미만 차트</h3>
              <p className="text-sm text-muted">짧은 간격 변화에 집중한 보기</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-outline/60 bg-white/70 p-4">
                <div className="text-sm text-muted">키 (cm)</div>
                <MetricChart metric="height" values={heightValues} labels={chartLabels} />
              </div>
              <div className="rounded-2xl border border-outline/60 bg-white/70 p-4">
                <div className="text-sm text-muted">몸무게 (kg)</div>
                <MetricChart metric="weight" values={weightValues} labels={chartLabels} />
              </div>
            </div>
          </div>

          <div className={`mt-5 space-y-5 ${currentVisit && currentVisit.ageMonths >= 36 ? "block" : "hidden"}`}>
            <div>
              <h3 className="text-lg font-semibold">36개월 이상 차트</h3>
              <p className="text-sm text-muted">장기 추세를 한눈에 볼 수 있는 보기</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-outline/60 bg-white/70 p-4">
                <div className="text-sm text-muted">키 (cm)</div>
                <MetricChart metric="height" values={heightValues} labels={chartLabels} />
              </div>
              <div className="rounded-2xl border border-outline/60 bg-white/70 p-4">
                <div className="text-sm text-muted">몸무게 (kg)</div>
                <MetricChart metric="weight" values={weightValues} labels={chartLabels} />
              </div>
            </div>
          </div>
        </section>

        <section className="card frost animate-[rise_1.3s_ease] p-6 lg:col-span-12">
          <h2 className="text-xl font-semibold">최근 방문 기록</h2>
          {historyVisits.length ? (
            <ul className="mt-4 grid gap-3">
              {historyVisits.map((visit) => (
                <li
                  key={visit.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline/60 bg-white/70 px-4 py-3"
                >
                  <strong className="text-sm text-ink">{formatDate(visit.date)}</strong>
                  <span className="text-xs text-muted">
                    키 {visit.height.toFixed(1)}cm · 몸무게 {visit.weight.toFixed(1)}kg · BMI {visit.bmi.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">저장된 방문 기록이 없습니다.</p>
          )}
        </section>
      </main>

      <footer className="mt-10 text-xs text-muted">
        {ageInfo && currentVisit ? `현재 환자 기준: ${ageLabel} · ${ageBucket}` : ""}
      </footer>
    </div>
  );
}
