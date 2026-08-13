"use client";

import { Activity } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  PolarAngleAxis,
  PolarGrid,
  Radar as RadarChartShape,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";

const trendData = [
  { time: "06", traffic: 42, air: 72, energy: 51 },
  { time: "08", traffic: 86, air: 63, energy: 68 },
  { time: "10", traffic: 74, air: 59, energy: 76 },
  { time: "12", traffic: 62, air: 64, energy: 72 },
  { time: "14", traffic: 67, air: 68, energy: 79 },
  { time: "16", traffic: 76, air: 65, energy: 83 },
  { time: "18", traffic: 94, air: 57, energy: 88 },
  { time: "20", traffic: 71, air: 61, energy: 74 },
  { time: "22", traffic: 51, air: 66, energy: 59 },
];

const balanceData = [
  { key: "Воздух", value: 66 },
  { key: "Безопасность", value: 77 },
  { key: "Транспорт", value: 69 },
  { key: "Шум", value: 61 },
  { key: "Комфорт", value: 71 },
  { key: "Энергия", value: 69 },
];

function formatUpdate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function AnalyticsCharts({ observedAt }: { observedAt: string }) {
  return (
    <>
      <Panel className="p-5 md:p-6"><div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-bold">Динамика за день</p><p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Моделируемые индексы · 0–100</p></div><Badge><Activity className="size-3" /> Обновлено {formatUpdate(observedAt)}</Badge></div><div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData}><defs><linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity={0.35}/><stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--chart-grid)" vertical={false}/><XAxis dataKey="time" stroke="var(--text-tertiary)" tickLine={false} axisLine={false} fontSize={10}/><YAxis stroke="var(--text-tertiary)" tickLine={false} axisLine={false} fontSize={10}/><Tooltip contentStyle={{ background: "var(--surface-panel-strong)", border: "1px solid var(--border-subtle)", borderRadius: 12, fontSize: 11 }}/><Area type="monotone" dataKey="traffic" stroke="var(--accent-cyan)" strokeWidth={2} fill="url(#trafficFill)"/><Line type="monotone" dataKey="energy" stroke="var(--accent-violet)" strokeWidth={1.5} dot={false}/></AreaChart></ResponsiveContainer></div></Panel>
      <Panel className="p-5 md:p-6"><p className="text-xs font-bold">Баланс города</p><p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Среднее по четырём районам</p><div className="mt-3 h-72"><ResponsiveContainer width="100%" height="100%"><RadarChart data={balanceData}><PolarGrid stroke="var(--chart-grid)"/><PolarAngleAxis dataKey="key" tick={{ fill: "var(--text-secondary)", fontSize: 9 }}/><RadarChartShape dataKey="value" stroke="var(--accent-green)" fill="var(--accent-green)" fillOpacity={0.2}/></RadarChart></ResponsiveContainer></div></Panel>
    </>
  );
}
