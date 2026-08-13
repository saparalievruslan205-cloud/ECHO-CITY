"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useTheme } from "next-themes";
import {
  Activity,
  AirVent,
  Bell,
  Building2,
  BusFront,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Download,
  FileChartColumnIncreasing,
  Gauge,
  GitCompareArrows,
  Globe2,
  Leaf,
  Lightbulb,
  LockKeyhole,
  Map,
  MapPin,
  Menu,
  Moon,
  Network,
  PanelLeftClose,
  Play,
  Plus,
  Radar,
  Route,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Thermometer,
  TrafficCone,
  TrainFront,
  TrendingDown,
  TrendingUp,
  Users,
  Volume2,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
import { CityMap } from "./CityMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { getFallbackSnapshot } from "@/lib/city-data";
import { runScenario } from "@/lib/simulation";
import type {
  CitySnapshot,
  ProblemType,
  ScenarioRequest,
  ScenarioResult,
  RealtimeMessage,
  SolutionType,
  UserRole,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type LayerKey = "transport" | "people" | "air" | "noise" | "energy" | "events";
type SectionKey = "map" | "analytics" | "districts" | "scenarios" | "reports" | "admin";

interface UserPreview {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
}

interface EchoCityAppProps {
  user: UserPreview | null;
}

const navItems: Array<{ id: SectionKey; label: string; icon: typeof Map }> = [
  { id: "map", label: "Карта", icon: Map },
  { id: "analytics", label: "Аналитика", icon: ChartNoAxesCombined },
  { id: "districts", label: "Районы", icon: Building2 },
  { id: "scenarios", label: "Сценарии", icon: GitCompareArrows },
  { id: "reports", label: "Отчёты", icon: FileChartColumnIncreasing },
  { id: "admin", label: "Управление", icon: Settings2 },
];

const layers: Array<{ id: LayerKey; label: string; icon: typeof BusFront; color: string }> = [
  { id: "transport", label: "Транспорт", icon: BusFront, color: "var(--accent-cyan)" },
  { id: "people", label: "Люди", icon: Users, color: "var(--accent-green)" },
  { id: "air", label: "Воздух", icon: AirVent, color: "var(--accent-mint)" },
  { id: "noise", label: "Шум", icon: Volume2, color: "var(--accent-amber)" },
  { id: "energy", label: "Энергия", icon: Zap, color: "var(--accent-violet)" },
  { id: "events", label: "События", icon: Bell, color: "var(--status-critical)" },
];

const problemOptions: Array<{ id: ProblemType; label: string; icon: typeof TrafficCone }> = [
  { id: "traffic", label: "Пробка", icon: TrafficCone },
  { id: "closure", label: "Перекрытие", icon: Route },
  { id: "pollution", label: "Загрязнение", icon: AirVent },
  { id: "noise", label: "Шумовая зона", icon: Volume2 },
];

const solutionOptions: Array<{ id: SolutionType; label: string; description: string; icon: typeof Route }> = [
  { id: "reroute", label: "Перенаправить поток", description: "Разгрузить ближайшие коридоры", icon: Route },
  { id: "transit-route", label: "Изменить маршрут", description: "Усилить общественный транспорт", icon: TrainFront },
  { id: "adaptive-lights", label: "Адаптивные светофоры", description: "Настроить циклы под нагрузку", icon: Lightbulb },
  { id: "low-emission-zone", label: "Зона низких выбросов", description: "Ограничить загрязняющий транспорт", icon: Leaf },
  { id: "green-buffer", label: "Зелёный буфер", description: "Создать парк и шумозащиту", icon: Sparkles },
];

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

const initialScenario: ScenarioRequest = {
  problem: {
    type: "traffic",
    coordinates: [74.6036, 42.8772],
    intensity: 72,
    radius: 1400,
    durationMinutes: 120,
    description: "Высокая нагрузка на перекрёсток в час пик",
  },
  solution: "adaptive-lights",
  timeOfDay: new Date().getHours(),
  weather: { windSpeed: 9, temperature: 24 },
};

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(value);
}

function formatUpdate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function ratingColor(value: number) {
  if (value >= 78) return "var(--accent-green)";
  if (value >= 65) return "var(--accent-amber)";
  return "var(--status-critical)";
}

export function EchoCityApp({ user }: EchoCityAppProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [section, setSection] = useState<SectionKey>("map");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [rightPanel, setRightPanel] = useState(true);
  const [snapshot, setSnapshot] = useState<CitySnapshot>(() => getFallbackSnapshot(true));
  const [connection, setConnection] = useState<"live" | "reconnecting" | "polling">("reconnecting");
  const [clock, setClock] = useState<Date | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<LayerKey>>(() => new Set(layers.map((layer) => layer.id)));
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const [scenario, setScenario] = useState<ScenarioRequest>(initialScenario);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [savedScenarioId, setSavedScenarioId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string>("");
  const [email, setEmail] = useState(user?.email ?? "");

  const theme = mounted && resolvedTheme === "light" ? "light" : "dark";

  useEffect(() => {
    if (!window.localStorage.getItem("theme")) {
      const hour = new Date().getHours();
      setTheme(hour >= 6 && hour < 19 ? "light" : "dark");
    }
    const firstTick = window.setTimeout(() => setClock(new Date()), 0);
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(timer);
    };
  }, [setTheme]);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let pollTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let attempts = 0;

    const loadSnapshot = async () => {
      try {
        const response = await fetch("/api/city/snapshot", { cache: "no-store" });
        if (!response.ok) throw new Error("snapshot");
        const next = await response.json() as CitySnapshot;
        if (active) {
          setSnapshot(next);
          setScenario((current) => ({ ...current, weather: { windSpeed: next.weather.windSpeed, temperature: next.weather.temperature } }));
        }
      } catch {
        if (active) setConnection("polling");
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      setConnection("polling");
      void loadSnapshot();
      pollTimer = window.setInterval(loadSnapshot, 5000);
    };

    const connect = () => {
      if (!active) return;
      if (!pollTimer) setConnection("reconnecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/realtime`);
      socket.addEventListener("open", () => {
        attempts = 0;
        setConnection("live");
        if (pollTimer) window.clearInterval(pollTimer);
        pollTimer = null;
      });
      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(String(event.data)) as RealtimeMessage;
          if (message.type === "snapshot") setSnapshot(message.payload as CitySnapshot);
          if (message.type === "metric.update") {
            setSnapshot((current) => ({
              ...current,
              observedAt: message.payload.updatedAt,
              districts: current.districts.map((district) => district.districtId === message.payload.districtId
                ? { ...district, sourceType: message.payload.sourceType, updatedAt: message.payload.updatedAt, values: { ...district.values, [message.payload.key]: message.payload.value } }
                : district),
            }));
          }
          if (message.type === "event.created") {
            setSnapshot((current) => ({ ...current, events: [message.payload, ...current.events.filter((item) => item.id !== message.payload.id)] }));
          }
          if (message.type === "scenario.progress") {
            setActionMessage(`Симуляция на сервере: ${message.payload.progress}%`);
          }
        } catch {
          // Ignore malformed realtime messages and keep the last valid snapshot.
        }
      });
      socket.addEventListener("close", () => {
        if (!active) return;
        attempts += 1;
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5));
        reconnectTimer = window.setTimeout(connect, delay);
        if (attempts >= 2) startPolling();
      });
      socket.addEventListener("error", () => socket?.close());
    };

    void loadSnapshot();
    connect();
    return () => {
      active = false;
      socket?.close();
      if (pollTimer) window.clearInterval(pollTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
    };
  }, []);

  const bestDistrict = useMemo(() => [...snapshot.districts].sort((a, b) => b.values.comfort - a.values.comfort)[0], [snapshot.districts]);

  const toggleLayer = (layer: LayerKey) => {
    setActiveLayers((current) => {
      const next = new Set(current);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  const handleMapPick = useCallback((coordinates: [number, number]) => {
    if (!simulatorOpen && !pickMode) return;
    setScenario((current) => ({ ...current, problem: { ...current.problem, coordinates } }));
    setPickMode(false);
    setActionMessage("Точка проблемы обновлена");
  }, [simulatorOpen, pickMode]);

  const runSimulation = () => {
    setIsRunning(true);
    setActionMessage("Модель перераспределяет городские потоки…");
    window.setTimeout(() => {
      try {
        const next = runScenario(scenario);
        setResult(next);
        setActionMessage("Прогноз рассчитан");
      } catch {
        setActionMessage("Проверьте параметры сценария");
      } finally {
        setIsRunning(false);
      }
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 20 : 950);
  };

  const saveScenario = async () => {
    if (!user) {
      setActionMessage("Войдите, чтобы сохранить сценарий");
      return;
    }
    try {
      const response = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: `Сценарий · ${problemOptions.find((item) => item.id === scenario.problem.type)?.label}`, request: scenario }),
      });
      const payload = await response.json() as { scenario?: { id: string }; error?: string };
      if (!response.ok || !payload.scenario) throw new Error(payload.error ?? "Не удалось сохранить");
      setSavedScenarioId(payload.scenario.id);
      if (result) await fetch(`/api/scenarios/${payload.scenario.id}/run`, { method: "POST" });
      setActionMessage("Сценарий сохранён в вашем профиле");
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Не удалось сохранить");
    }
  };

  const createReport = async () => {
    if (!savedScenarioId) {
      setActionMessage("Сначала сохраните и запустите сценарий");
      return;
    }
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId: savedScenarioId, email: email || undefined }),
      });
      const payload = await response.json() as { report?: { downloadUrl: string; emailSent: boolean }; error?: string };
      if (!response.ok || !payload.report) throw new Error(payload.error ?? "Не удалось создать PDF");
      setActionMessage(payload.report.emailSent ? "PDF создан и отправлен на почту" : "PDF создан — можно скачать");
      window.location.assign(payload.report.downloadUrl);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Не удалось создать отчёт");
    }
  };

  return (
    <div className="relative h-[100dvh] min-h-[620px] overflow-hidden bg-[var(--surface-base)] text-[var(--text-primary)]">
      <a href="#city-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--surface-panel-strong)] focus:px-4 focus:py-2">Перейти к карте</a>

      <header className="absolute inset-x-0 top-0 z-40 flex h-[72px] items-center border-b border-[var(--border-subtle)] bg-[var(--surface-header)] px-4 backdrop-blur-2xl md:px-6">
        <div className="flex min-w-[190px] items-center gap-3">
          <div className="relative grid size-9 place-items-center rounded-xl border border-[var(--accent-cyan)]/35 bg-[var(--accent-cyan)]/10 shadow-[0_0_26px_var(--accent-cyan-glow)]">
            <Globe2 className="size-4.5 text-[var(--accent-cyan)]" />
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--accent-green)] ring-2 ring-[var(--surface-header)]" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5"><span className="font-[var(--font-display)] text-[15px] font-extrabold tracking-[0.12em]">ECHO</span><span className="font-[var(--font-display)] text-[15px] font-light tracking-[0.12em] text-[var(--accent-cyan)]">CITY</span></div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Bishkek urban twin</p>
          </div>
        </div>

        <nav className="mx-auto hidden h-full items-center gap-1 lg:flex" aria-label="Основные разделы">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" onClick={() => setSection(item.id)} className={cn("relative flex h-full items-center gap-2 px-3.5 text-xs font-semibold text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", section === item.id && "text-[var(--text-primary)]")}>
                <Icon className={cn("size-3.5", section === item.id && "text-[var(--accent-cyan)]")} />
                {item.label}
                {section === item.id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--accent-cyan)] shadow-[0_0_12px_var(--accent-cyan)]" />}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 xl:flex">
            <span className={cn("size-1.5 rounded-full", connection === "live" ? "bg-[var(--accent-green)] echo-live-dot" : "bg-[var(--accent-amber)]")} />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">{connection === "live" ? "Live" : connection === "polling" ? "Polling" : "Sync"}</span>
            <span className="h-3 w-px bg-[var(--border-subtle)]" />
            <span className="font-mono text-[11px] text-[var(--text-primary)]" suppressHydrationWarning>{clock ? formatTime(clock) : "--:--:--"}</span>
          </div>
          <Button variant="ghost" size="icon" aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {mounted && theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </Button>
          {user ? (
            <button type="button" className="hidden h-10 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 pr-3 sm:flex">
              <span className="grid size-6 place-items-center rounded-full bg-[var(--accent-cyan)]/16 text-[10px] font-bold text-[var(--accent-cyan)]">{user.displayName.slice(0, 1).toUpperCase()}</span>
              <span className="max-w-24 truncate text-xs font-semibold">{user.displayName}</span>
              <ChevronDown className="size-3 text-[var(--text-tertiary)]" />
            </button>
          ) : (
            <Button asChild size="sm" className="hidden sm:inline-flex"><a href="/signin-with-chatgpt?return_to=%2F">Войти</a></Button>
          )}
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Открыть меню" onClick={() => setMobileMenu(true)}><Menu className="size-5" /></Button>
        </div>
      </header>

      <main id="city-main" className="absolute inset-0 pt-[72px]">
        <CityMap
          theme={theme}
          activeLayers={activeLayers}
          events={snapshot.events}
          problemPoint={simulatorOpen || result ? scenario.problem.coordinates : null}
          result={result}
          pickMode={pickMode}
          onPick={handleMapPick}
        />

        <Panel className="absolute left-4 top-[88px] z-20 hidden w-[242px] overflow-hidden lg:block">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Слои города</p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{activeLayers.size} активных потоков</p>
            </div>
            <Waves className="size-4 text-[var(--accent-cyan)]" />
          </div>
          <div className="p-2">
            {layers.map((layer) => {
              const Icon = layer.icon;
              const active = activeLayers.has(layer.id);
              return (
                <button key={layer.id} type="button" aria-pressed={active} onClick={() => toggleLayer(layer.id)} className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", active ? "bg-[var(--surface-hover)] text-[var(--text-primary)]" : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]")}>
                  <span className="grid size-7 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)]" style={{ color: layer.color }}><Icon className="size-3.5" /></span>
                  <span className="flex-1 text-xs font-semibold">{layer.label}</span>
                  <span className={cn("relative h-4 w-7 rounded-full border transition-colors", active ? "border-[var(--accent-cyan)]/35 bg-[var(--accent-cyan)]/22" : "border-[var(--border-strong)] bg-[var(--surface-muted)]")}><span className={cn("absolute top-0.5 size-2.5 rounded-full transition-transform", active ? "translate-x-3 bg-[var(--accent-cyan)]" : "translate-x-0.5 bg-[var(--text-tertiary)]")} /></span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-[var(--border-subtle)] p-3">
            <button type="button" onClick={() => setSimulatorOpen(true)} className="group flex w-full items-center gap-3 rounded-xl border border-[var(--accent-cyan)]/25 bg-[var(--accent-cyan)]/8 p-3 text-left hover:bg-[var(--accent-cyan)]/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
              <span className="grid size-8 place-items-center rounded-lg bg-[var(--accent-cyan)] text-[var(--action-primary-fg)] shadow-[var(--shadow-action)]"><Plus className="size-4" /></span>
              <span className="flex-1"><span className="block text-xs font-bold text-[var(--text-primary)]">Новый сценарий</span><span className="mt-0.5 block text-[10px] text-[var(--text-tertiary)]">Смоделировать решение</span></span>
              <ChevronRight className="size-3.5 text-[var(--accent-cyan)] transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </Panel>

        <div className="absolute left-4 top-[88px] z-20 flex items-center gap-2 lg:hidden">
          <Button variant="secondary" size="sm" onClick={() => setSection("analytics")}><Activity className="size-3.5" /> Показатели</Button>
          <Button variant="secondary" size="icon" className="size-9 min-h-9" aria-label="Создать сценарий" onClick={() => setSimulatorOpen(true)}><Plus className="size-4" /></Button>
        </div>

        <Panel className={cn("absolute right-4 top-[88px] z-20 hidden w-[310px] overflow-hidden transition-transform xl:block", !rightPanel && "translate-x-[330px]")}>
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3.5">
            <div className="flex items-center gap-2"><Radar className="size-4 text-[var(--accent-cyan)]" /><span className="text-xs font-bold">Город сейчас</span></div>
            <button type="button" aria-label="Скрыть панель" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" onClick={() => setRightPanel(false)}><PanelLeftClose className="size-4 rotate-180" /></button>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)]">
            <KpiCell icon={Thermometer} label="Температура" value={`${Math.round(snapshot.weather.temperature)}°`} meta={`ветер ${Math.round(snapshot.weather.windSpeed)} км/ч`} accent="var(--accent-cyan)" />
            <KpiCell icon={AirVent} label="Воздух" value={`${Math.round(snapshot.air.aqi)}`} meta={`PM2.5 · ${Math.round(snapshot.air.pm25)}`} accent={snapshot.air.aqi > 80 ? "var(--status-critical)" : "var(--accent-green)"} />
            <KpiCell icon={Gauge} label="Скорость" value={`${snapshot.averageSpeed}`} meta="км/ч · модель" accent="var(--accent-amber)" />
            <KpiCell icon={Zap} label="Энергия" value={`${snapshot.energyLoad}%`} meta="нагрузка сети" accent="var(--accent-violet)" />
          </div>
          <div className="border-t border-[var(--border-subtle)] p-4">
            <div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">События</span><Badge>{snapshot.events.length} активных</Badge></div>
            <div className="space-y-2">
              {snapshot.events.slice(0, 3).map((event) => (
                <button key={event.id} type="button" className="flex w-full gap-3 rounded-xl border border-transparent p-2 text-left hover:border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                  <span className={cn("mt-1 size-2 shrink-0 rounded-full", event.severity === "critical" ? "bg-[var(--status-critical)]" : event.severity === "warning" ? "bg-[var(--accent-amber)]" : "bg-[var(--accent-cyan)]")} />
                  <span><span className="block text-xs font-semibold leading-snug">{event.title}</span><span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-tertiary)]">{event.description}</span></span>
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--border-subtle)] p-4">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Лучший комфорт</p><p className="mt-1 text-sm font-bold">{bestDistrict?.districtName}</p></div><div className="grid size-11 place-items-center rounded-full border-4 border-[var(--accent-green)]/22 text-sm font-bold text-[var(--accent-green)]">{bestDistrict?.values.comfort}</div></div>
          </div>
        </Panel>
        {!rightPanel && <Button variant="secondary" size="icon" className="absolute right-4 top-[88px] z-20 hidden xl:inline-flex" aria-label="Показать панель" onClick={() => setRightPanel(true)}><Activity className="size-4" /></Button>}

        <div className="absolute bottom-5 left-1/2 z-20 hidden -translate-x-1/2 md:block">
          <button type="button" onClick={() => setSimulatorOpen(true)} className="group flex min-h-14 items-center gap-4 rounded-2xl border border-[var(--accent-cyan)]/28 bg-[var(--surface-panel-strong)] px-4 py-2.5 shadow-[var(--shadow-floating)] backdrop-blur-2xl transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            <span className="relative grid size-9 place-items-center rounded-xl bg-[var(--accent-cyan)] text-[var(--action-primary-fg)]"><Network className="size-4" /><span className="absolute inset-0 rounded-xl echo-command-pulse" /></span>
            <span className="text-left"><span className="block text-sm font-bold">Создать городскую проблему</span><span className="block text-[10px] text-[var(--text-tertiary)]">Выберите решение и увидьте прогноз</span></span>
            <span className="ml-2 grid size-8 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)]"><ChevronRight className="size-4 text-[var(--accent-cyan)] transition-transform group-hover:translate-x-0.5" /></span>
          </button>
        </div>

        <div className="absolute inset-x-3 bottom-3 z-30 md:hidden">
          <Panel className="flex items-center justify-around px-1 py-1.5">
            {navItems.slice(0, 4).map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setSection(item.id)} className={cn("flex min-h-12 min-w-14 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-semibold text-[var(--text-tertiary)]", section === item.id && "bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]")}><Icon className="size-4" />{item.label}</button>; })}
            <button type="button" onClick={() => setSimulatorOpen(true)} className="grid size-12 place-items-center rounded-xl bg-[var(--accent-cyan)] text-[var(--action-primary-fg)] shadow-[var(--shadow-action)]" aria-label="Новый сценарий"><Plus className="size-5" /></button>
          </Panel>
        </div>

        {section !== "map" && (
          <SectionOverlay
            section={section}
            snapshot={snapshot}
            user={user}
            result={result}
            onClose={() => setSection("map")}
            onSimulate={() => setSimulatorOpen(true)}
          />
        )}
      </main>

      <Dialog.Root open={simulatorOpen} onOpenChange={(open) => { setSimulatorOpen(open); if (!open) setPickMode(false); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--overlay-scrim)] backdrop-blur-[3px] data-[state=open]:animate-[echo-fade-in_180ms_ease-out]" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[28px] border border-[var(--border-subtle)] bg-[var(--surface-panel-strong)] shadow-[var(--shadow-dialog)] focus:outline-none md:inset-auto md:right-5 md:top-1/2 md:max-h-[94dvh] md:w-[560px] md:-translate-y-1/2 md:rounded-[24px] data-[state=open]:animate-[echo-sheet-in_260ms_cubic-bezier(.2,.8,.2,1)]">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-panel-strong)]/94 px-5 py-4 backdrop-blur-xl md:px-6">
              <div><Dialog.Title className="font-[var(--font-display)] text-lg font-bold">Симулятор решений</Dialog.Title><Dialog.Description className="mt-1 text-xs text-[var(--text-tertiary)]">Создайте проблему и сравните прогноз до и после</Dialog.Description></div>
              <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Закрыть симулятор"><X className="size-4" /></Button></Dialog.Close>
            </div>

            <div className="space-y-6 p-5 md:p-6">
              <fieldset>
                <legend className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]"><span className="grid size-5 place-items-center rounded-full bg-[var(--accent-cyan)]/12 text-[var(--accent-cyan)]">1</span> Тип проблемы</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {problemOptions.map((option) => { const Icon = option.icon; const selected = scenario.problem.type === option.id; return <button key={option.id} type="button" onClick={() => setScenario((current) => ({ ...current, problem: { ...current.problem, type: option.id } }))} className={cn("flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-xl border p-2 text-center text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", selected ? "border-[var(--accent-cyan)]/55 bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]" : "border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]")}><Icon className="size-4" />{option.label}</button>; })}
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]"><span className="grid size-5 place-items-center rounded-full bg-[var(--accent-cyan)]/12 text-[var(--accent-cyan)]">2</span> Параметры</legend>
                <button type="button" onClick={() => setPickMode(true)} className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", pickMode ? "border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/8" : "border-[var(--border-subtle)] bg-[var(--surface-muted)]")}><MapPin className="size-4 text-[var(--accent-cyan)]" /><span className="flex-1"><span className="block text-xs font-semibold">{scenario.problem.coordinates[1].toFixed(4)}, {scenario.problem.coordinates[0].toFixed(4)}</span><span className="block text-[10px] text-[var(--text-tertiary)]">{pickMode ? "Кликните по карте" : "Изменить точку на карте"}</span></span><ChevronRight className="size-4 text-[var(--text-tertiary)]" /></button>
                <label className="block"><span className="mb-2 flex justify-between text-xs"><span className="font-semibold">Интенсивность</span><span className="font-mono text-[var(--accent-cyan)]">{scenario.problem.intensity}%</span></span><input aria-label="Интенсивность проблемы" type="range" min="1" max="100" value={scenario.problem.intensity} onChange={(event) => setScenario((current) => ({ ...current, problem: { ...current.problem, intensity: Number(event.target.value) } }))} className="echo-range w-full" /></label>
                <div className="grid grid-cols-2 gap-3">
                  <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Радиус, м</span><input type="number" min="100" max="5000" value={scenario.problem.radius} onChange={(event) => setScenario((current) => ({ ...current, problem: { ...current.problem, radius: Number(event.target.value) } }))} className="echo-input" /></label>
                  <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Время, мин</span><input type="number" min="10" max="1440" value={scenario.problem.durationMinutes} onChange={(event) => setScenario((current) => ({ ...current, problem: { ...current.problem, durationMinutes: Number(event.target.value) } }))} className="echo-input" /></label>
                </div>
                <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Описание</span><textarea value={scenario.problem.description} maxLength={500} onChange={(event) => setScenario((current) => ({ ...current, problem: { ...current.problem, description: event.target.value } }))} className="echo-input min-h-20 resize-none py-3" /></label>
              </fieldset>

              <fieldset>
                <legend className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]"><span className="grid size-5 place-items-center rounded-full bg-[var(--accent-cyan)]/12 text-[var(--accent-cyan)]">3</span> Решение</legend>
                <div className="space-y-2">
                  {solutionOptions.map((option) => { const Icon = option.icon; const selected = scenario.solution === option.id; return <button key={option.id} type="button" onClick={() => setScenario((current) => ({ ...current, solution: option.id }))} className={cn("flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", selected ? "border-[var(--accent-green)]/48 bg-[var(--accent-green)]/8" : "border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)]")}><span className={cn("grid size-8 place-items-center rounded-lg", selected ? "bg-[var(--accent-green)]/15 text-[var(--accent-green)]" : "bg-[var(--surface-raised)] text-[var(--text-tertiary)]")}><Icon className="size-4" /></span><span className="flex-1"><span className="block text-xs font-semibold">{option.label}</span><span className="mt-0.5 block text-[10px] text-[var(--text-tertiary)]">{option.description}</span></span>{selected && <Check className="size-4 text-[var(--accent-green)]" />}</button>; })}
                </div>
              </fieldset>

              <Button size="lg" className="w-full" onClick={runSimulation} disabled={isRunning}>{isRunning ? <><Activity className="size-4 animate-pulse" /> Рассчитываем потоки…</> : <><Play className="size-4 fill-current" /> Запустить прогноз</>}</Button>

              {result && <SimulationResult result={result} onSave={saveScenario} onReport={createReport} user={user} email={email} setEmail={setEmail} />}
              <div aria-live="polite" className="min-h-5 text-center text-xs text-[var(--text-secondary)]">{actionMessage}</div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {mobileMenu && (
        <div className="fixed inset-0 z-[70] bg-[var(--surface-panel-strong)] p-5 lg:hidden">
          <div className="flex items-center justify-between"><span className="font-[var(--font-display)] font-bold tracking-[0.12em]">ECHO CITY</span><Button variant="ghost" size="icon" aria-label="Закрыть меню" onClick={() => setMobileMenu(false)}><X className="size-5" /></Button></div>
          <nav className="mt-8 space-y-2" aria-label="Мобильное меню">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => { setSection(item.id); setMobileMenu(false); }} className="flex min-h-14 w-full items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 text-left text-sm font-semibold"><Icon className="size-4 text-[var(--accent-cyan)]" />{item.label}<ChevronRight className="ml-auto size-4 text-[var(--text-tertiary)]" /></button>; })}</nav>
          {!user && <Button asChild className="mt-6 w-full"><a href="/signin-with-chatgpt?return_to=%2F">Войти через ChatGPT</a></Button>}
        </div>
      )}
    </div>
  );
}

function KpiCell({ icon: Icon, label, value, meta, accent }: { icon: typeof Gauge; label: string; value: string; meta: string; accent: string }) {
  return <div className="bg-[var(--surface-panel)] p-3.5"><div className="mb-3 flex items-center justify-between"><span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">{label}</span><Icon className="size-3.5" style={{ color: accent }} /></div><div className="font-[var(--font-display)] text-xl font-bold tracking-[-0.04em]" style={{ color: accent }}>{value}</div><div className="mt-1 text-[9px] text-[var(--text-tertiary)]">{meta}</div></div>;
}

function SectionOverlay({ section, snapshot, user, result, onClose, onSimulate }: { section: SectionKey; snapshot: CitySnapshot; user: UserPreview | null; result: ScenarioResult | null; onClose: () => void; onSimulate: () => void }) {
  const title = navItems.find((item) => item.id === section)?.label ?? "Раздел";
  return (
    <div className="absolute inset-x-0 bottom-0 top-[72px] z-30 overflow-y-auto bg-[var(--overlay-page)] px-3 pb-24 pt-3 backdrop-blur-xl md:px-8 md:pb-8 md:pt-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between"><div><Badge>Городская система</Badge><h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold tracking-[-0.04em] md:text-3xl">{title}</h1></div><Button variant="secondary" size="icon" aria-label="Закрыть раздел" onClick={onClose}><X className="size-4" /></Button></div>
        {section === "analytics" && <AnalyticsView snapshot={snapshot} />}
        {section === "districts" && <DistrictsView snapshot={snapshot} />}
        {section === "scenarios" && <ScenariosView result={result} user={user} onSimulate={onSimulate} />}
        {section === "reports" && <ReportsView result={result} user={user} onSimulate={onSimulate} />}
        {section === "admin" && <AdminView user={user} snapshot={snapshot} />}
      </div>
    </div>
  );
}

function AnalyticsView({ snapshot }: { snapshot: CitySnapshot }) {
  return <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
    <Panel className="p-5 md:p-6"><div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-bold">Динамика за день</p><p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Моделируемые индексы · 0–100</p></div><Badge><Activity className="size-3" /> Обновлено {formatUpdate(snapshot.observedAt)}</Badge></div><div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData}><defs><linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity={0.35}/><stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--chart-grid)" vertical={false}/><XAxis dataKey="time" stroke="var(--text-tertiary)" tickLine={false} axisLine={false} fontSize={10}/><YAxis stroke="var(--text-tertiary)" tickLine={false} axisLine={false} fontSize={10}/><Tooltip contentStyle={{ background: "var(--surface-panel-strong)", border: "1px solid var(--border-subtle)", borderRadius: 12, fontSize: 11 }}/><Area type="monotone" dataKey="traffic" stroke="var(--accent-cyan)" strokeWidth={2} fill="url(#trafficFill)"/><Line type="monotone" dataKey="energy" stroke="var(--accent-violet)" strokeWidth={1.5} dot={false}/></AreaChart></ResponsiveContainer></div></Panel>
    <Panel className="p-5 md:p-6"><p className="text-xs font-bold">Баланс города</p><p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Среднее по четырём районам</p><div className="mt-3 h-72"><ResponsiveContainer width="100%" height="100%"><RadarChart data={[{ key: "Воздух", value: 66 }, { key: "Безопасность", value: 77 }, { key: "Транспорт", value: 69 }, { key: "Шум", value: 61 }, { key: "Комфорт", value: 71 }, { key: "Энергия", value: 69 }]}><PolarGrid stroke="var(--chart-grid)"/><PolarAngleAxis dataKey="key" tick={{ fill: "var(--text-secondary)", fontSize: 9 }}/><RadarChartShape dataKey="value" stroke="var(--accent-green)" fill="var(--accent-green)" fillOpacity={0.2}/></RadarChart></ResponsiveContainer></div></Panel>
    <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2"><MetricCard icon={BusFront} label="На линии" value={`${snapshot.activeTransportUnits}`} meta="единиц · модель" color="var(--accent-cyan)"/><MetricCard icon={Wind} label="PM2.5" value={`${Math.round(snapshot.air.pm25)}`} meta="мкг/м³ · Open-Meteo" color="var(--accent-green)"/><MetricCard icon={Zap} label="Пик нагрузки" value={`${snapshot.energyLoad}%`} meta="энергосистема · модель" color="var(--accent-violet)"/></div>
  </div>;
}

function DistrictsView({ snapshot }: { snapshot: CitySnapshot }) {
  return <div className="grid gap-4 md:grid-cols-2">{snapshot.districts.map((district, index) => { const total = Math.round(Object.values(district.values).reduce((sum, value) => sum + value, 0) / 6); return <Panel key={district.districtId} className="overflow-hidden"><div className="flex items-center justify-between border-b border-[var(--border-subtle)] p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--accent-cyan)]/10 text-sm font-bold text-[var(--accent-cyan)]">0{index + 1}</span><div><h2 className="text-sm font-bold">{district.districtName}</h2><p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">Моделируемые показатели</p></div></div><div className="text-right"><div className="font-[var(--font-display)] text-2xl font-bold" style={{ color: ratingColor(total) }}>{total}</div><span className="text-[9px] text-[var(--text-tertiary)]">общий рейтинг</span></div></div><div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)] sm:grid-cols-3">{Object.entries(district.values).map(([key, value]) => <div key={key} className="bg-[var(--surface-panel)] p-4"><div className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">{{ air: "Воздух", safety: "Безопасность", transport: "Транспорт", noise: "Тишина", comfort: "Комфорт", energy: "Энергия" }[key]}</div><div className="flex items-end gap-2"><span className="text-lg font-bold">{value}</span><span className="mb-1 h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]"><span className="block h-full rounded-full" style={{ width: `${value}%`, background: ratingColor(value) }} /></span></div></div>)}</div></Panel>; })}</div>;
}

function ScenariosView({ result, user, onSimulate }: { result: ScenarioResult | null; user: UserPreview | null; onSimulate: () => void }) {
  return <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]"><Panel className="p-6"><div className="grid size-11 place-items-center rounded-2xl bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]"><GitCompareArrows className="size-5" /></div><h2 className="mt-5 text-lg font-bold">Лаборатория решений</h2><p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">Поставьте проблему на карту, выберите вмешательство и сравните изменение транспорта, воздуха, шума и комфорта.</p><Button className="mt-6" onClick={onSimulate}><Plus className="size-4" /> Новый сценарий</Button>{!user && <p className="mt-4 flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]"><LockKeyhole className="size-3.5" /> Для сохранения потребуется вход</p>}</Panel>{result ? <Panel className="p-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold">Последний прогноз</p><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Уверенность модели {result.confidence}%</p></div><Badge>Готово</Badge></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{result.metrics.map((metric) => <div key={metric.key} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"><span className="text-[9px] text-[var(--text-tertiary)]">{metric.label}</span><div className="mt-2 flex items-baseline gap-1.5"><span className="text-lg font-bold">{metric.after}</span><span className="text-[9px] text-[var(--text-tertiary)]">{metric.unit}</span></div><span className={cn("mt-1 inline-flex text-[10px] font-bold", metric.favorable ? "text-[var(--accent-green)]" : "text-[var(--status-critical)]")}>{metric.delta > 0 ? "+" : ""}{metric.delta}</span></div>)}</div></Panel> : <Panel className="grid min-h-72 place-items-center p-6 text-center"><div><Radar className="mx-auto size-7 text-[var(--text-tertiary)]"/><p className="mt-3 text-sm font-semibold">Здесь появится сравнение</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">Запустите первый прогноз</p></div></Panel>}</div>;
}

function ReportsView({ result, user, onSimulate }: { result: ScenarioResult | null; user: UserPreview | null; onSimulate: () => void }) {
  return <div className="grid gap-4 lg:grid-cols-3"><Panel className="p-6 lg:col-span-2"><div className="flex items-start justify-between"><div><Badge>PDF / 30 дней</Badge><h2 className="mt-3 text-lg font-bold">Отчёты по сценариям</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">Зафиксируйте исходные условия, решение, прогнозные показатели и затронутые транспортные коридоры в одном документе.</p></div><FileChartColumnIncreasing className="size-7 text-[var(--accent-cyan)]" /></div><div className="mt-6 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid size-12 place-items-center rounded-xl bg-[var(--surface-raised)]"><Download className="size-5 text-[var(--accent-green)]" /></div><div className="flex-1"><p className="text-sm font-semibold">{result ? "Прогноз готов к сохранению" : "Нет рассчитанного сценария"}</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">{result ? `Уверенность ${result.confidence}% · ${result.metrics.length} показателей` : "Сначала создайте городской сценарий"}</p></div><Button variant={result ? "primary" : "secondary"} onClick={onSimulate}>{result ? "Открыть сценарий" : "Создать"}</Button></div></div></Panel><Panel className="p-6"><ShieldCheck className="size-6 text-[var(--accent-green)]"/><h3 className="mt-4 text-sm font-bold">Контроль доступа</h3><p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Отчёт доступен только владельцу, аналитику или администратору.</p><div className="mt-5 border-t border-[var(--border-subtle)] pt-4"><Badge>{user ? "Вход выполнен" : "Требуется вход"}</Badge></div></Panel></div>;
}

function AdminView({ user, snapshot }: { user: UserPreview | null; snapshot: CitySnapshot }) {
  if (user?.role !== "admin") return <Panel className="mx-auto grid min-h-[420px] max-w-2xl place-items-center p-8 text-center"><div><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]"><LockKeyhole className="size-6" /></div><h2 className="mt-5 text-lg font-bold">Административный доступ</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">Управление пользователями, событиями, показателями и журналом действий доступно только роли администратора.</p>{!user && <Button asChild className="mt-6"><a href="/signin-with-chatgpt?return_to=%2F">Войти через ChatGPT</a></Button>}</div></Panel>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard icon={Users} label="Пользователи" value="128" meta="+14 за неделю" color="var(--accent-cyan)"/><MetricCard icon={Bell} label="События" value={`${snapshot.events.length}`} meta="активных на карте" color="var(--accent-amber)"/><MetricCard icon={Building2} label="Показатели" value="24" meta="6 × 4 района" color="var(--accent-green)"/><MetricCard icon={ShieldCheck} label="Аудит" value="100%" meta="действия фиксируются" color="var(--accent-violet)"/><Panel className="p-6 md:col-span-2 xl:col-span-4"><h2 className="text-sm font-bold">Операционный журнал</h2><div className="mt-4 space-y-2">{["metric.create", "event.status.update", "user.role.update"].map((action, index) => <div key={action} className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"><span className="size-2 rounded-full bg-[var(--accent-green)]"/><code className="text-xs text-[var(--accent-cyan)]">{action}</code><span className="ml-auto text-[10px] text-[var(--text-tertiary)]">{index + 2} мин назад</span></div>)}</div></Panel></div>;
}

function MetricCard({ icon: Icon, label, value, meta, color }: { icon: typeof Gauge; label: string; value: string; meta: string; color: string }) {
  return <Panel className="p-5"><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{label}</span><Icon className="size-4" style={{ color }} /></div><div className="mt-4 font-[var(--font-display)] text-3xl font-bold tracking-[-0.05em]" style={{ color }}>{value}</div><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{meta}</p></Panel>;
}

function SimulationResult({ result, onSave, onReport, user, email, setEmail }: { result: ScenarioResult; onSave: () => void; onReport: () => void; user: UserPreview | null; email: string; setEmail: (value: string) => void }) {
  return <div className="space-y-4 border-t border-[var(--border-subtle)] pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-bold">Прогноз результата</p><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Горизонт · {result.horizon.max} {result.horizon.unit === "minutes" ? "минут" : "месяцев"}</p></div><div className="flex items-center gap-2 rounded-full border border-[var(--accent-green)]/25 bg-[var(--accent-green)]/8 px-3 py-1.5 text-[10px] font-bold text-[var(--accent-green)]"><ShieldCheck className="size-3" /> {result.confidence}%</div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{result.metrics.map((metric) => <div key={metric.key} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"><span className="block text-[9px] text-[var(--text-tertiary)]">{metric.label}</span><div className="mt-1.5 flex items-baseline gap-1"><span className="font-[var(--font-display)] text-lg font-bold">{metric.after}</span><span className="text-[9px] text-[var(--text-tertiary)]">{metric.unit}</span></div><div className={cn("mt-1 flex items-center gap-1 text-[10px] font-bold", metric.favorable ? "text-[var(--accent-green)]" : "text-[var(--status-critical)]")}>{metric.favorable ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{metric.delta > 0 ? "+" : ""}{metric.delta}</div></div>)}</div><div className="rounded-xl border border-[var(--accent-amber)]/25 bg-[var(--accent-amber)]/7 p-3 text-[10px] leading-5 text-[var(--text-secondary)]"><CircleAlert className="mr-2 inline size-3.5 text-[var(--accent-amber)]" />{result.disclaimer}</div>{user ? <div className="space-y-3"><label><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Email для отчёта</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="echo-input" /></label><div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={onSave}><Save className="size-4" /> Сохранить</Button><Button onClick={onReport}><Download className="size-4" /> PDF</Button></div></div> : <Button asChild className="w-full"><a href="/signin-with-chatgpt?return_to=%2F"><LockKeyhole className="size-4" /> Войти и сохранить</a></Button>}</div>;
}
