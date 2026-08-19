"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Tab = "today" | "dashboard" | "record";
type SectionName = "pretty" | "brain";
type Primitive = string | number | boolean;

type DailyData = {
  pretty: Record<string, Primitive>;
  brain: Record<string, Primitive>;
  record: Record<string, Primitive>;
  sessions?: TaskSession[];
};

type Store = {
  startDate: string;
  days: Record<string, DailyData>;
};

type CheckItem = {
  key: string;
  label: string;
  optional?: boolean;
};

type FieldItem = {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea" | "checkbox";
  target?: number;
};

type TimerSession = {
  start: number;
  end?: number | null;
};

type HabitCard = {
  id: string;
  title: string;
  subtitle?: string;
  section: SectionName;
  checks?: CheckItem[];
  fields?: FieldItem[];
  resource?: keyof typeof resources;
  customDone?: (data: DailyData) => boolean;
  customTotal?: (data: DailyData) => { done: number; total: number };
};

type PlannerTodo = {
  id: string;
  text: string;
  done: boolean;
};

type TaskSession = {
  id: string;
  taskId: string;
  taskName: string;
  category: "pretty" | "brain";
  goalMinutes: number;
  startedAt: number;
  endedAt?: number;
  isRunning: boolean;
};

type TimerTask = {
  id: string;
  name: string;
  category: "pretty" | "brain";
  goalMinutes: number;
  description?: string;
};

type DailyDataWithSessions = DailyData & {
  sessions?: TaskSession[];
};

const storageKey = "prettyna-store-v1";
const dayMs = 1000 * 60 * 60 * 24;
const timerStartSuffix = "_started_at";
const timerSessionSuffix = "_sessions";
// task 개수만큼 색을 넉넉히 마련해 카테고리 안에서도 task별로 겹치지 않게 구분한다.
// PRETTY 4개는 1:1로 전부 다른 색, BRAIN 8개는 7가지 색을 순환(마지막 1개만 재사용)한다.
const categoryColorPalette: Record<SectionName, string[]> = {
  pretty: ["#ff45da", "#ff4da7", "#ff777a", "#ff8066"],
  brain: ["#ffa75b", "#2c73d2", "#ffd254", "#008f7a", "#f9f871", "#0089ba", "#00c9a7"],
};

const categoryColors: Record<SectionName, string> = {
  pretty: categoryColorPalette.pretty[1],
  brain: categoryColorPalette.brain[1],
};

const resources = {
  guaSha: "https://www.youtube.com/results?search_query=face+gua+sha+routine",
  cardio: "https://www.youtube.com/results?search_query=30+minute+cardio+workout",
  strength: "https://www.youtube.com/results?search_query=30+minute+strength+workout",
  voice: "https://www.youtube.com/results?search_query=voice+training+practice",
  english: "https://learnenglish.britishcouncil.org/",
  opic: "https://www.youtube.com/results?search_query=OPIc+practice",
  data: "https://www.kaggle.com/learn",
};

// 타이머 기반 Task들 (Today 화면에서 실행)
const timerTasks: TimerTask[] = [
  // PRETTY
  { id: "morning_gua_sha", name: "얼굴 괄사 (아침)", category: "pretty", goalMinutes: 10 },
  { id: "evening_gua_sha", name: "얼굴 괄사 (저녁)", category: "pretty", goalMinutes: 10 },
  { id: "cardio", name: "유산소", category: "pretty", goalMinutes: 30 },
  { id: "strength", name: "근력", category: "pretty", goalMinutes: 30 },
  // BRAIN
  { id: "news", name: "뉴스", category: "brain", goalMinutes: 20 },
  { id: "company_study", name: "회사 공부", category: "brain", goalMinutes: 20 },
  { id: "common_knowledge", name: "상식", category: "brain", goalMinutes: 20 },
  { id: "interview_prep", name: "면접 준비", category: "brain", goalMinutes: 30 },
  { id: "data_study", name: "데이터 공부", category: "brain", goalMinutes: 30 },
  { id: "project", name: "내 프로젝트", category: "brain", goalMinutes: 20 },
  { id: "language", name: "언어 공부", category: "brain", goalMinutes: 30 },
  { id: "voice", name: "발성 연습", category: "brain", goalMinutes: 10 },
];

// 카테고리별 팔레트를 순환 배정해 Dashboard Time Table과 시각적으로 연동한다.
const taskColors: Record<string, string> = (() => {
  const counters: Record<SectionName, number> = { pretty: 0, brain: 0 };
  const map: Record<string, string> = {};
  timerTasks.forEach((task) => {
    const palette = categoryColorPalette[task.category];
    const index = counters[task.category]++;
    map[task.id] = palette[index % palette.length];
  });
  return map;
})();

const prettyCards: HabitCard[] = [
  {
    id: "morning",
    title: "Morning Routine",
    subtitle: "기상, 괄사, 자기암시, 아침 스킨케어",
    section: "pretty",
    resource: "guaSha",
    checks: [
      { key: "wake_6", label: "06:00 기상 성공" },
      { key: "morning_affirmation", label: "자기암시 완료" },
      { key: "morning_cleanser", label: "폼클렌징" },
      { key: "morning_moisturizer", label: "수분크림" },
      { key: "morning_sunscreen", label: "선크림" },
    ],
    fields: [{ key: "morning_gua_sha_minutes", label: "얼굴 괄사", type: "number", target: 10 }],
  },
  {
    id: "evening",
    title: "Evening Routine",
    subtitle: "괄사, 자기암시, 저녁 스킨케어",
    section: "pretty",
    resource: "guaSha",
    checks: [
      { key: "evening_affirmation", label: "자기암시 완료" },
      { key: "evening_cleanser", label: "폼클렌징" },
      { key: "evening_moisturizer", label: "수분크림" },
      { key: "evening_mask", label: "팩 1회" },
      { key: "evening_footcream", label: "풋크림" },
    ],
    fields: [{ key: "evening_gua_sha_minutes", label: "얼굴 괄사", type: "number", target: 10 }],
  },
  {
    id: "exercise",
    title: "Exercise",
    subtitle: "유산소와 근력은 30분 이상이면 완료",
    section: "pretty",
    resource: "cardio",
    fields: [
      { key: "cardio_minutes", label: "유산소", type: "number", target: 30 },
      { key: "strength_minutes", label: "근력", type: "number", target: 30 },
    ],
  },
  {
    id: "dailyCare",
    title: "Daily Care",
    subtitle: "자잘한 관리 행동",
    section: "pretty",
    checks: [
      { key: "water", label: "물 충분히 마시기" },
      { key: "handcream", label: "핸드크림 바르기" },
      { key: "no_nail_biting", label: "손톱 물어뜯지 않기" },
      { key: "nail_gel", label: "영양젤 바르기" },
    ],
  },
  {
    id: "grooming",
    title: "Grooming",
    subtitle: "필요한 날만 달성률에 포함",
    section: "pretty",
    customTotal: (data) => {
      if (!data.pretty.grooming_needed) return { done: 0, total: 0 };
      const keys = ["eyeline", "lip", "blush", "clothes_ready"];
      return {
        done: keys.filter((key) => Boolean(data.pretty[key])).length,
        total: keys.length,
      };
    },
    fields: [{ key: "grooming_needed", label: "오늘 필요", type: "checkbox" }],
    checks: [
      { key: "eyeline", label: "아이라인" },
      { key: "lip", label: "립" },
      { key: "blush", label: "볼터치" },
      { key: "clothes_ready", label: "전날 옷 준비" },
    ],
  },
  {
    id: "diet",
    title: "Diet",
    subtitle: "점심과 저녁 식단을 정리해보세요",
    section: "pretty",
    fields: [
      { key: "lunch_meal", label: "점심", type: "textarea" },
      { key: "dinner_meal", label: "저녁", type: "textarea" },
    ],
  },
];

const brainCards: HabitCard[] = [
  {
    id: "knowledge",
    title: "Knowledge",
    subtitle: "뉴스와 상식",
    section: "brain",
    fields: [
      { key: "news_minutes", label: "뉴스 공부 시간", type: "number", target: 20 },
      { key: "news_note", label: "오늘 본 뉴스", type: "textarea" },
      { key: "common_minutes", label: "상식 공부 시간", type: "number", target: 20 },
      { key: "common_note", label: "오늘 알게 된 내용", type: "textarea" },
    ],
  },
  {
    id: "career",
    title: "Career",
    subtitle: "오늘 준비한 것만 기록해보세요",
    section: "brain",
    fields: [{ key: "interview_prepared", label: "오늘 준비한 것", type: "textarea" }],
  },
  {
    id: "dataProject",
    title: "Data & Project",
    subtitle: "데이터 공부와 내 프로젝트",
    section: "brain",
    resource: "data",
    fields: [
      { key: "data_minutes", label: "데이터 공부 시간", type: "number", target: 30 },
      { key: "data_note", label: "오늘 공부한 내용", type: "textarea" },
      { key: "project_minutes", label: "내 프로젝트 작업 시간", type: "number", target: 20 },
      { key: "project_work", label: "오늘 한 작업", type: "textarea" },
      { key: "project_learned", label: "오늘 배운 개념 또는 내용", type: "textarea" },
    ],
  },
  {
    id: "language",
    title: "Language & Speaking",
    subtitle: "언어 공부, OPIc, 발성 연습",
    section: "brain",
    resource: "english",
    fields: [
      { key: "language_minutes", label: "언어 공부 시간", type: "number", target: 30 },
      { key: "language_name", label: "공부한 언어", type: "text" },
      { key: "language_expressions", label: "오늘 배운 표현 최소 3개", type: "textarea" },
      { key: "opic_minutes", label: "OPIc 공부 시간", type: "number" },
      { key: "opic_note", label: "오늘 연습한 내용", type: "textarea" },
      { key: "voice_minutes", label: "발성 연습 시간", type: "number", target: 10 },
      { key: "voice_recorded", label: "녹음 1회 완료", type: "checkbox" },
    ],
  },
];

const allCards = [...prettyCards, ...brainCards];

const habitSummary = [
  { label: "6시 기상", test: (day: DailyData) => Boolean(day.pretty.wake_6) },
  {
    label: "운동",
    test: (day: DailyData) => elapsedMinutes(day.pretty, "cardio_minutes") >= 30 || elapsedMinutes(day.pretty, "strength_minutes") >= 30,
  },
  {
    label: "괄사",
    test: (day: DailyData) =>
      elapsedMinutes(day.pretty, "morning_gua_sha_minutes") >= 10 || elapsedMinutes(day.pretty, "evening_gua_sha_minutes") >= 10,
  },
  {
    label: "스킨케어",
    test: (day: DailyData) =>
      Boolean(day.pretty.morning_cleanser) ||
      Boolean(day.pretty.morning_moisturizer) ||
      Boolean(day.pretty.morning_sunscreen) ||
      Boolean(day.pretty.evening_cleanser) ||
      Boolean(day.pretty.evening_moisturizer),
  },
  { label: "식단", test: (day: DailyData) => Boolean(day.pretty.diet_meal) },
  { label: "뉴스", test: (day: DailyData) => elapsedMinutes(day.brain, "news_minutes") >= 20 },
  { label: "데이터 공부", test: (day: DailyData) => elapsedMinutes(day.brain, "data_minutes") >= 30 },
  { label: "언어 공부", test: (day: DailyData) => elapsedMinutes(day.brain, "language_minutes") >= 30 },
];

function emptyDay(): DailyData {
  return { pretty: {}, brain: {}, record: {}, sessions: [] };
}

function todayKey() {
  return toDateKey(new Date());
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, offset: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

function getDayNumber(startDate: string, dateKey: string) {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const selected = new Date(`${dateKey}T00:00:00`).getTime();
  return Math.min(30, Math.max(1, Math.floor((selected - start) / dayMs) + 1));
}

function readNumber(value: Primitive | undefined) {
  return typeof value === "number" ? value : Number(value || 0);
}

function startedAtKey(key: string) {
  return `${key}${timerStartSuffix}`;
}

function sessionKey(key: string) {
  return `${key}${timerSessionSuffix}`;
}

function readTimerSessions(data: DailyData | Record<string, Primitive>, key: string): TimerSession[] {
  const raw = String((data as any)[sessionKey(key)] || "[]");
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        start: Number(item.start || 0),
        end: item.end === null || item.end === undefined ? null : Number(item.end || 0),
      }))
      .filter((item) => item.start > 0);
  } catch {
    return [];
  }
}

function readTodoList(data: Record<string, Primitive>): PlannerTodo[] {
  const raw = String(data.todoList || "[]");
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)),
        text: String(item.text || ""),
        done: Boolean(item.done),
      }))
      .filter((item) => item.text.trim().length > 0);
  } catch {
    return [];
  }
}

function readSessions(data: DailyData | Record<string, Primitive>, key: string = "sessions"): TaskSession[] {
  const raw = (data as any)[key];
  let parsed: unknown;
  if (Array.isArray(raw)) {
    parsed = raw;
  } else {
    try {
      parsed = JSON.parse(String(raw || "[]"));
    } catch {
      parsed = [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: String(item.id || `${Date.now()}-${Math.random()}`),
      taskId: String(item.taskId || ""),
      taskName: String(item.taskName || ""),
      category: (item.category === "pretty" || item.category === "brain" ? item.category : "pretty") as "pretty" | "brain",
      goalMinutes: Number(item.goalMinutes || 0),
      startedAt: Number(item.startedAt || 0),
      endedAt: item.endedAt ? Number(item.endedAt) : undefined,
      isRunning: Boolean(item.isRunning),
    }))
    .filter((item) => item.taskId && item.startedAt > 0);
}

function elapsedMinutes(data: Record<string, Primitive>, key: string, now = Date.now()) {
  const savedMinutes = readNumber(data[key]);
  const sessions = readTimerSessions(data, key);
  const activeSession = sessions.find((session) => !session.end);
  if (sessions.length > 0) {
    return savedMinutes + (activeSession ? Math.max(0, now - Number(activeSession.start)) / 60000 : 0);
  }
  const startedAt = readNumber(data[startedAtKey(key)]);
  if (!startedAt) return savedMinutes;
  return savedMinutes + Math.max(0, now - startedAt) / 60000;
}

function formatDuration(minutes: number) {
  const totalSeconds = Math.floor(minutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(mins).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(mins).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatHoursMinutes(minutes: number) {
  const totalMinutes = Math.floor(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m`;
}

function cardProgress(card: HabitCard, day: DailyData, now = Date.now()) {
  if (card.customTotal) return card.customTotal(day);
  let done = 0;
  let total = 0;
  const data = day[card.section];

  card.checks?.forEach((check) => {
    if (check.optional) return;
    total += 1;
    if (data[check.key]) done += 1;
  });

  card.fields?.forEach((field) => {
    if (!field.target) return;
    total += 1;
    if (elapsedMinutes(data, field.key, now) >= field.target) done += 1;
  });

  return { done, total };
}

function percent(done: number, total: number) {
  return total === 0 ? 100 : Math.round((done / total) * 100);
}

function sectionProgress(cards: HabitCard[], day: DailyData, now = Date.now()) {
  return cards.reduce(
    (sum, card) => {
      const current = cardProgress(card, day, now);
      return { done: sum.done + current.done, total: sum.total + current.total };
    },
    { done: 0, total: 0 },
  );
}

function ensureDay(store: Store, dateKey: string): Store {
  if (store.days[dateKey]) return store;
  return {
    ...store,
    days: {
      ...store.days,
      [dateKey]: emptyDay(),
    },
  };
}

function initialStore(): Store {
  const key = todayKey();
  return {
    startDate: key,
    days: {
      [key]: emptyDay(),
    },
  };
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("today");
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [store, setStore] = useState<Store>(() => initialStore());
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Store;
        setStore(ensureDay(parsed, todayKey()));
        setSelectedDate(todayKey());
      } catch {
        setStore(initialStore());
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(storageKey, JSON.stringify(ensureDay(store, selectedDate)));
  }, [loaded, selectedDate, store]);

  useEffect(() => {
    setStore((current) => ensureDay(current, selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const currentDay = store.days[selectedDate] ?? emptyDay();
  const plannerEntries = buildPlannerEntries(currentDay, now);
  const prettyProgress = sectionProgress(prettyCards, currentDay, now);
  const brainProgress = sectionProgress(brainCards, currentDay, now);
  const totalDone = prettyProgress.done + brainProgress.done;
  const totalItems = prettyProgress.total + brainProgress.total;
  const todayPercent = percent(totalDone, totalItems);
  const prettyPercent = percent(prettyProgress.done, prettyProgress.total);
  const brainPercent = percent(brainProgress.done, brainProgress.total);
  const dayNumber = getDayNumber(store.startDate, selectedDate);
  const totalStudyMinutes = readSessions(currentDay, "sessions")
    .filter((session) => session.category === "brain")
    .reduce((sum, session) => sum + Math.max(0, (session.isRunning ? now : session.endedAt ?? now) - session.startedAt) / 60000, 0);

  const calendarDays = useMemo(
    () => Array.from({ length: 30 }, (_, index) => addDays(store.startDate, index)),
    [store.startDate],
  );

  function update(section: keyof DailyData, key: string, value: Primitive) {
    setStore((current) => {
      const baseDay = current.days[selectedDate] ?? emptyDay();
      return {
        ...current,
        days: {
          ...current.days,
          [selectedDate]: {
            ...baseDay,
            [section]: {
              ...baseDay[section],
              [key]: value,
            },
          },
        },
      };
    });
  }

  function syncTimerSession(section: keyof DailyData, key: string, mode: "start" | "pause" | "reset", timestamp = Date.now()) {
    setStore((current) => {
      const baseDay = current.days[selectedDate] ?? emptyDay();
      const selected = baseDay[section] ?? {};
      const sessions = readTimerSessions(selected as any, key);
      const nextSessions = [...sessions];

      if (mode === "start") {
        const active = nextSessions.find((session) => !session.end);
        if (!active) nextSessions.push({ start: timestamp, end: null });
      }

      if (mode === "pause") {
        const active = nextSessions.find((session) => !session.end);
        if (active) active.end = timestamp;
      }

      if (mode === "reset") {
        return {
          ...current,
          days: {
            ...current.days,
            [selectedDate]: {
              ...baseDay,
              [section]: {
                ...selected,
                [key]: 0,
                [startedAtKey(key)]: 0,
                [sessionKey(key)]: JSON.stringify([]),
              },
            },
          },
        };
      }

      return {
        ...current,
        days: {
          ...current.days,
          [selectedDate]: {
            ...baseDay,
            [section]: {
              ...selected,
              [sessionKey(key)]: JSON.stringify(nextSessions),
            },
          },
        },
      };
    });
  }

  function startTimerTask(task: TimerTask) {
    const day = store.days[selectedDate] ?? emptyDay();
    const allSessions = readSessions(day, "sessions");
    
    // Check if another timer is running
    const activeTimer = allSessions.find((s) => s.isRunning);
    if (activeTimer) {
      alert(`현재 "${activeTimer.taskName}"이(가) 진행 중입니다.\n먼저 현재 작업을 종료해주세요.`);
      return;
    }

    // Create new session
    const newSession: TaskSession = {
      id: `${task.id}-${Date.now()}`,
      taskId: task.id,
      taskName: task.name,
      category: task.category,
      goalMinutes: task.goalMinutes,
      startedAt: Date.now(),
      isRunning: true,
    };

    const nextSessions = [...allSessions, newSession];
    setStore((current) => ({
      ...current,
      days: {
        ...current.days,
        [selectedDate]: {
          ...(current.days[selectedDate] ?? emptyDay()),
          sessions: nextSessions,
        },
      },
    }));
  }

  function endTimerTask(taskId: string) {
    const day = store.days[selectedDate] ?? emptyDay();
    const allSessions = readSessions(day, "sessions");
    
    const nextSessions = allSessions.map((s) =>
      s.isRunning && s.taskId === taskId ? { ...s, endedAt: Date.now(), isRunning: false } : s
    );

    setStore((current) => ({
      ...current,
      days: {
        ...current.days,
        [selectedDate]: {
          ...(current.days[selectedDate] ?? emptyDay()),
          sessions: nextSessions,
        },
      },
    }));
  }

  function undoLastTaskSession(taskId: string) {
    const day = store.days[selectedDate] ?? emptyDay();
    const allSessions = readSessions(day, "sessions");
    const taskSessions = allSessions.filter((s) => s.taskId === taskId);
    if (taskSessions.length === 0) return;

    const lastSession = taskSessions.reduce((latest, session) => (session.startedAt > latest.startedAt ? session : latest));
    if (!window.confirm(`"${lastSession.taskName}"의 가장 최근 기록을 취소할까요?`)) return;

    const nextSessions = allSessions.filter((s) => s.id !== lastSession.id);
    setStore((current) => ({
      ...current,
      days: {
        ...current.days,
        [selectedDate]: {
          ...(current.days[selectedDate] ?? emptyDay()),
          sessions: nextSessions,
        },
      },
    }));
  }

  function addPosting() {
    const raw = String(currentDay.brain.job_postings || "[]");
    const items = safePostings(raw);
    const next = [...items, { company: "", role: "", applied: false }];
    update("brain", "job_postings", JSON.stringify(next));
  }

  function updatePosting(index: number, key: "company" | "role" | "applied", value: string | boolean) {
    const items = safePostings(String(currentDay.brain.job_postings || "[]"));
    items[index] = { ...items[index], [key]: value };
    update("brain", "job_postings", JSON.stringify(items));
  }

  function removePosting(index: number) {
    const items = safePostings(String(currentDay.brain.job_postings || "[]"));
    update("brain", "job_postings", JSON.stringify(items.filter((_, itemIndex) => itemIndex !== index)));
  }

  function resetStartDate() {
    if (!window.confirm("오늘을 1일차로 다시 설정할까요? 지금까지 날짜별로 기록한 데이터는 그대로 유지돼요.")) return;
    setStore((current) => ({ ...current, startDate: todayKey() }));
  }

  function handleImage(event: ChangeEvent<HTMLInputElement>, key: "facePhoto" | "bodyPhoto") {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("record", key, String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function updateTodo(dateKey: string, next: PlannerTodo[]) {
    setStore((current) => {
      const baseDay = current.days[dateKey] ?? emptyDay();
      return {
        ...current,
        days: {
          ...current.days,
          [dateKey]: {
            ...baseDay,
            record: {
              ...baseDay.record,
              todoList: JSON.stringify(next),
            },
          },
        },
      };
    });
  }

  return (
    <main className="app">
      <header className="topbar">
        <h1 className="brand">PRETTYNA</h1>
        <label className="date-picker">
          날짜
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
      </header>

      <section className="hero" aria-label="오늘 진행 상황">
        <div className="hero-main">
          <div>
            <div className="day-row">
              <p className="day">DAY {String(dayNumber).padStart(2, "0")} / 30</p>
              <button type="button" className="day-reset-btn" onClick={resetStartDate}>
                오늘부터 1일차
              </button>
            </div>
            <p className="today-score">
              <span className="today-label-group">
                TODAY <span className="study-time-inline">({formatHoursMinutes(totalStudyMinutes)})</span>
              </span>{" "}
              {todayPercent}%
            </p>
          </div>
          <div className="split-score">
            PRETTY {prettyPercent}% · BRAIN {brainPercent}%
          </div>
        </div>
        <div className="progress">
          <span style={{ width: `${todayPercent}%` }} />
        </div>
      </section>

      {tab === "today" && (
        <section className="section">
          <div className="timer-tasks-section">
            {timerTasks.map((task) => {
              const sessions = readSessions(currentDay, "sessions").filter((s) => s.taskId === task.id);
              const activeTimer = sessions.find((s) => s.isRunning);
              const hasActiveTimer = readSessions(currentDay, "sessions").some((s) => s.isRunning && s.taskId !== task.id);
              
              return (
                <TaskTimerCard
                  key={task.id}
                  task={task}
                  sessions={sessions}
                  onStart={() => startTimerTask(task)}
                  onEnd={() => endTimerTask(task.id)}
                  onUndo={() => undoLastTaskSession(task.id)}
                  now={now}
                  hasActiveTimer={hasActiveTimer}
                />
              );
            })}
          </div>

          <article className="card">
            <div className="row-between">
              <h2 className="card-title">오늘의 학습 정리</h2>
              <span className="badge">Memo</span>
            </div>
            <label className="field">
              오늘 배운 내용 / 핵심 정리
              <textarea
                value={String(currentDay.record.note || "")}
                onChange={(event) => update("record", "note", event.target.value)}
                placeholder="오늘 무엇을 공부했고, 핵심은 무엇이었는지 적어보세요."
              />
            </label>
          </article>

          <article className="card">
            <div className="row-between">
              <h2 className="card-title">뉴스 & 상식</h2>
              <span className="badge">Study</span>
            </div>
            <div className="fields">
              <label className="field">
                오늘 본 뉴스
                <textarea
                  value={String(currentDay.brain.news_note || "")}
                  onChange={(event) => update("brain", "news_note", event.target.value)}
                  placeholder="오늘 본 뉴스 중 기억할 내용을 적어보세요."
                />
              </label>
              <label className="field">
                오늘 알게 된 내용
                <textarea
                  value={String(currentDay.brain.common_note || "")}
                  onChange={(event) => update("brain", "common_note", event.target.value)}
                  placeholder="오늘 새로 알게 된 상식이나 배운 내용을 적어보세요."
                />
              </label>
            </div>
          </article>

          <article className="card">
            <div className="row-between">
              <h2 className="card-title">커리어</h2>
              <span className="badge">Career</span>
            </div>
            <div className="fields">
              <label className="field">
                오늘 준비한 것
                <textarea
                  value={String(currentDay.brain.interview_prepared || "")}
                  onChange={(event) => update("brain", "interview_prepared", event.target.value)}
                  placeholder="면접 준비, 회사 공부, 챕터 정리 등을 적어보세요."
                />
              </label>
            </div>
          </article>

          <article className="card">
            <div className="row-between">
              <h2 className="card-title">프로젝트 & 배움</h2>
              <span className="badge">Learn</span>
            </div>
            <div className="fields">
              <label className="field">
                오늘 한 작업
                <textarea
                  value={String(currentDay.brain.project_work || "")}
                  onChange={(event) => update("brain", "project_work", event.target.value)}
                  placeholder="프로젝트에서 한 작업을 적어보세요."
                />
              </label>
              <label className="field">
                오늘 배운 개념 / 내용
                <textarea
                  value={String(currentDay.brain.project_learned || "")}
                  onChange={(event) => update("brain", "project_learned", event.target.value)}
                  placeholder="오늘 배운 개념, 팁, 인사이트를 적어보세요."
                />
              </label>
            </div>
          </article>

          <article className="card">
            <div className="row-between">
              <h2 className="card-title">언어 표현</h2>
              <span className="badge">Words</span>
            </div>
            <label className="field">
              오늘 배운 표현
              <textarea
                value={String(currentDay.brain.language_expressions || "")}
                onChange={(event) => update("brain", "language_expressions", event.target.value)}
                placeholder="외운 표현이나 문장을 적어보세요."
              />
            </label>
          </article>

          <article className="card">
            <div className="row-between">
              <h2 className="card-title">유산소</h2>
              <span className="badge">Exercise</span>
            </div>
            <label className="field">
              오늘 유산소 운동
              <textarea
                value={String(currentDay.pretty.cardio_note || "")}
                onChange={(event) => update("pretty", "cardio_note", event.target.value)}
                placeholder="오늘 한 유산소 운동 내용을 적어보세요."
              />
            </label>
          </article>

          <article className="card">
            <div className="row-between">
              <h2 className="card-title">무산소</h2>
              <span className="badge">Exercise</span>
            </div>
            <label className="field">
              오늘 무산소 운동
              <textarea
                value={String(currentDay.pretty.strength_note || "")}
                onChange={(event) => update("pretty", "strength_note", event.target.value)}
                placeholder="오늘 한 근력(무산소) 운동 내용을 적어보세요."
              />
            </label>
          </article>
        </section>
      )}

      {tab === "dashboard" && (
        <Dashboard
          store={store}
          calendarDays={calendarDays}
          selectedDate={selectedDate}
          selectDate={setSelectedDate}
          setTab={setTab}
          dayNumber={getDayNumber(store.startDate, todayKey())}
          todayPercent={todayPercent}
          prettyPercent={prettyPercent}
          brainPercent={brainPercent}
          now={now}
          onUpdateTodo={updateTodo}
          currentDay={currentDay}
          update={update}
          syncTimerSession={syncTimerSession}
        />
      )}

      {tab === "record" && (
        <RecordView currentDay={currentDay} update={update} handleImage={handleImage} store={store} selectedDate={selectedDate} />
      )}

      <nav className="bottom-nav" aria-label="주요 메뉴">
        {[
          ["today", "Today"],
          ["dashboard", "Dashboard"],
          ["record", "Record"],
        ].map(([key, label]) => (
          <button
            className={`nav-button ${tab === key ? "active" : ""}`}
            key={key}
            type="button"
            onClick={() => setTab(key as Tab)}
          >
            {label}
          </button>
        ))}
      </nav>
    </main>
  );
}

function renderHabitCard(
  card: HabitCard,
  currentDay: DailyData,
  update: (section: keyof DailyData, key: string, value: Primitive) => void,
  now: number,
  syncTimerSession: (section: keyof DailyData, key: string, mode: "start" | "pause" | "reset", timestamp?: number) => void,
) {
  const progress = cardProgress(card, currentDay, now);
  const score = percent(progress.done, progress.total);
  const data = currentDay[card.section];
  const isDone = progress.total > 0 && progress.done === progress.total;
  const visibleChecks = card.id === "grooming" && !data.grooming_needed ? [] : card.checks;
  const timerEntries = buildCardTimelineEntries(card, currentDay, now);

  return (
    <details className={`sub-card ${isDone ? "done" : ""}`} key={card.id} open>
      <summary>
        <div className="sub-card-shell">
          <div className="sub-card-label">{card.title}</div>
          <div className="sub-card-content">
            <div className="sub-card-top">
              {card.subtitle && <span className="sub-card-subtitle">{card.subtitle}</span>}
              <span className="badge">{progress.total === 0 ? "제외" : `${score}%`}</span>
            </div>

            <div className="sub-card-body-row">
              {visibleChecks && visibleChecks.length > 0 && (
                <div className="checks sub-card-checks">
                  {visibleChecks.map((check) => (
                    <label className="check" key={check.key}>
                      <input
                        type="checkbox"
                        checked={Boolean(data[check.key])}
                        onChange={(event) => update(card.section, check.key, event.target.checked)}
                      />
                      <span>{check.label}</span>
                    </label>
                  ))}
                </div>
              )}
              
              {timerEntries.length > 0 && (
                <div className="sub-card-timeline">
                  {timerEntries.slice(0, 2).map((entry) => (
                    <div className="timeline-item" key={entry.id}>
                      <span className="timeline-label">{entry.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </summary>

      <div className="sub-card-body">
        {card.resource && (
          <a className="resource-link" href={resources[card.resource]} target="_blank" rel="noreferrer">
            자료 보기
          </a>
        )}

        <div className="timer-layout">
          <div className="timer-main">
            {card.fields && (
              <div className="fields">
                {card.fields.map((field) => (
                  <FieldControl
                    field={field}
                    key={field.key}
                    section={card.section}
                    now={now}
                    startedAt={data[startedAtKey(field.key)]}
                    value={data[field.key]}
                    onChange={(value) => update(card.section, field.key, value)}
                    onStartedAtChange={(value) => update(card.section, startedAtKey(field.key), value)}
                    onTimerStart={(key) => syncTimerSession(card.section, key, "start")}
                    onTimerPause={(key) => syncTimerSession(card.section, key, "pause")}
                    onTimerReset={(key) => syncTimerSession(card.section, key, "reset")}
                  />
                ))}
              </div>
            )}
          </div>

          {timerEntries.length > 0 && (
            <div className="planner-panel">
              <p className="planner-panel-title">실시간 일정</p>
              {timerEntries.map((entry) => (
                <div className="mini-planner-row" key={entry.id}>
                  <span className="mini-planner-dot" style={{ background: entry.color }} />
                  <div className="mini-planner-copy">
                    <strong>{entry.label}</strong>
                    <span>
                      {formatClock(entry.start)} ~ {entry.active ? "지금" : formatClock(entry.end)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

function FieldControl({
  field,
  section,
  now,
  startedAt,
  value,
  onChange,
  onStartedAtChange,
  onTimerStart,
  onTimerPause,
  onTimerReset,
}: {
  field: FieldItem;
  section: keyof DailyData;
  now: number;
  startedAt: Primitive | undefined;
  value: Primitive | undefined;
  onChange: (value: Primitive) => void;
  onStartedAtChange: (value: Primitive) => void;
  onTimerStart: (key: string) => void;
  onTimerPause: (key: string) => void;
  onTimerReset: (key: string) => void;
}) {
  if (field.type === "checkbox") {
    return (
      <label className="check">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{field.label}</span>
      </label>
    );
  }

  if (field.type === "number" && field.target) {
    return (
      <StopwatchControl
        field={field}
        section={section}
        now={now}
        startedAt={startedAt}
        value={value}
        onChange={onChange}
        onStartedAtChange={onStartedAtChange}
        onTimerStart={onTimerStart}
        onTimerPause={onTimerPause}
        onTimerReset={onTimerReset}
      />
    );
  }

  return (
    <label className="field">
      {field.label}
      {field.type === "textarea" ? (
        <textarea value={String(value || "")} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input
          type={field.type || "text"}
          min={field.type === "number" ? 0 : undefined}
          inputMode={field.type === "number" ? "numeric" : undefined}
          value={String(value || "")}
          onChange={(event) => onChange(field.type === "number" ? Number(event.target.value) : event.target.value)}
          placeholder={field.target ? `${field.target}분 이상` : undefined}
        />
      )}
    </label>
  );
}

function StopwatchControl({
  field,
  section,
  now,
  startedAt,
  value,
  onChange,
  onStartedAtChange,
  onTimerStart,
  onTimerPause,
  onTimerReset,
}: {
  field: FieldItem;
  section: keyof DailyData;
  now: number;
  startedAt: Primitive | undefined;
  value: Primitive | undefined;
  onChange: (value: Primitive) => void;
  onStartedAtChange: (value: Primitive) => void;
  onTimerStart: (key: string) => void;
  onTimerPause: (key: string) => void;
  onTimerReset: (key: string) => void;
}) {
  const baseMinutes = readNumber(value);
  const startTime = readNumber(startedAt);
  const running = startTime > 0;
  const currentMinutes = startTime ? baseMinutes + Math.max(0, now - startTime) / 60000 : baseMinutes;
  const reached = currentMinutes >= (field.target || 0);

  function start() {
    if (running) return;
    const nextStart = Date.now();
    onStartedAtChange(nextStart);
    onTimerStart(field.key);
  }

  function pause() {
    if (!running) return;
    onChange(currentMinutes);
    onStartedAtChange(0);
    onTimerPause(field.key);
  }

  function reset() {
    onChange(0);
    onStartedAtChange(0);
    onTimerReset(field.key);
  }

  return (
    <div className={`timer ${reached ? "reached" : ""}`}>
      <div className="timer-top">
        <div>
          <p className="timer-label">{field.label}</p>
          <p className="timer-target">목표 {field.target}분</p>
        </div>
        <span className="timer-state">{reached ? "달성" : "진행"}</span>
      </div>
      <div className="timer-time">{formatDuration(currentMinutes)}</div>
      <div className="timer-actions">
        <button className="soft-button primary" type="button" onClick={running ? pause : start}>
          {running ? "일시정지" : "시작"}
        </button>
        <button className="soft-button" type="button" onClick={reset}>
          초기화
        </button>
      </div>
    </div>
  );
}

function JobPostings({
  items,
  onAdd,
  onChange,
  onRemove,
}: {
  items: Array<{ company: string; role: string; applied: boolean }>;
  onAdd: () => void;
  onChange: (index: number, key: "company" | "role" | "applied", value: string | boolean) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <article className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title">채용공고</h3>
          <p className="card-subtitle">여러 공고를 추가할 수 있어요</p>
        </div>
        <button className="soft-button primary" type="button" onClick={onAdd}>
          추가
        </button>
      </div>

      <div className="fields">
        {items.map((item, index) => (
          <div className="posting-item" key={index}>
            <label className="field">
              회사명
              <input value={item.company} onChange={(event) => onChange(index, "company", event.target.value)} />
            </label>
            <label className="field">
              직무
              <input value={item.role} onChange={(event) => onChange(index, "role", event.target.value)} />
            </label>
            <label className="check">
              <input checked={item.applied} type="checkbox" onChange={(event) => onChange(index, "applied", event.target.checked)} />
              <span>지원 완료</span>
            </label>
            <button className="soft-button" type="button" onClick={() => onRemove(index)}>
              삭제
            </button>
          </div>
        ))}
      </div>
    </article>
  );
}

function TaskTimerCard({
  task,
  sessions,
  onStart,
  onEnd,
  onUndo,
  now,
  hasActiveTimer,
}: {
  task: TimerTask;
  sessions: TaskSession[];
  onStart: () => void;
  onEnd: () => void;
  onUndo: () => void;
  now: number;
  hasActiveTimer: boolean;
}) {
  const activeSession = sessions.find((s) => s.isRunning);
  
  // Calculate elapsed time for active session
  const activeElapsedMinutes = activeSession ? (now - activeSession.startedAt) / 60000 : 0;
  
  // Calculate total time from completed sessions
  const completedMinutes = sessions
    .filter((s) => s.endedAt)
    .reduce((sum, s) => sum + ((s.endedAt! - s.startedAt) / 60000), 0);
  
  // Total is completed + active
  const totalMinutes = completedMinutes + activeElapsedMinutes;
  const reached = totalMinutes >= task.goalMinutes;

  const formatTime = (minutes: number) => {
    const totalSeconds = Math.floor(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const color = taskColors[task.id] ?? categoryColors[task.category];

  return (
    <article className={`timer-task-card ${activeSession ? "active" : ""}`} style={{ borderTopColor: color }}>
      <button
        type="button"
        className="timer-undo-btn"
        onClick={onUndo}
        disabled={sessions.length === 0}
        aria-label={`${task.name} 최근 기록 취소`}
        title="가장 최근 기록 취소"
      >
        ↺
      </button>

      <div className="timer-task-head">
        <h3 className="timer-task-title">
          <span className="timer-task-dot" style={{ background: color }} />
          {task.name}
        </h3>
        <span className="timer-task-goal">{task.goalMinutes}분</span>
      </div>

      <div className="timer-display">
        <p className="timer-value">{formatTime(totalMinutes)}</p>
        {reached && <span className="timer-badge reached">달성</span>}
      </div>

      {!activeSession ? (
        <button
          className="timer-action-btn start-btn"
          onClick={onStart}
          disabled={hasActiveTimer}
          type="button"
        >
          ▶ 시작
        </button>
      ) : (
        <button className="timer-action-btn stop-btn" onClick={onEnd} type="button">
          ■ 종료
        </button>
      )}

      {hasActiveTimer && !activeSession && (
        <p className="timer-warning">다른 타이머 진행 중</p>
      )}
    </article>
  );
}

function Dashboard({
  store,
  calendarDays,
  selectedDate,
  selectDate,
  setTab,
  dayNumber,
  todayPercent,
  prettyPercent,
  brainPercent,
  now,
  onUpdateTodo,
  currentDay,
  update,
  syncTimerSession,
}: {
  store: Store;
  calendarDays: string[];
  selectedDate: string;
  selectDate: (date: string) => void;
  setTab: (tab: Tab) => void;
  dayNumber: number;
  todayPercent: number;
  prettyPercent: number;
  brainPercent: number;
  now: number;
  onUpdateTodo: (dateKey: string, next: PlannerTodo[]) => void;
  currentDay: DailyData;
  update: (section: keyof DailyData, key: string, value: Primitive) => void;
  syncTimerSession: (section: keyof DailyData, key: string, mode: "start" | "pause" | "reset", timestamp?: number) => void;
}) {
  const [todoDrafts, setTodoDrafts] = useState<Record<string, string>>({});
  const bodyChanges = getBodyChanges(store);

  function addTodo(dateKey: string) {
    const text = (todoDrafts[dateKey] || "").trim();
    if (!text) return;
    const existing = readTodoList(store.days[dateKey]?.record || {});
    onUpdateTodo(dateKey, [...existing, { id: `${dateKey}-${Date.now()}`, text, done: false }]);
    setTodoDrafts((current) => ({ ...current, [dateKey]: "" }));
  }

  function toggleTodo(dateKey: string, id: string) {
    const next = readTodoList(store.days[dateKey]?.record || {}).map((item) =>
      item.id === id ? { ...item, done: !item.done } : item,
    );
    onUpdateTodo(dateKey, next);
  }

  function removeTodo(dateKey: string, id: string) {
    const next = readTodoList(store.days[dateKey]?.record || {}).filter((item) => item.id !== id);
    onUpdateTodo(dateKey, next);
  }

  return (
    <section className="section">
      <article className="card">
        <div className="row-between">
          <div>
            <h2 className="card-title">30 Day Progress</h2>
            <p className="card-subtitle">DAY {String(dayNumber).padStart(2, "0")} / 30</p>
          </div>
          <span className="badge">{Math.round((dayNumber / 30) * 100)}%</span>
        </div>
        <div className="progress">
          <span style={{ width: `${Math.round((dayNumber / 30) * 100)}%` }} />
        </div>
      </article>

      <article className="card">
        <h2 className="card-title">Today's Progress</h2>
        <ul className="summary-list">
          <li>
            <span>전체</span>
            <strong>{todayPercent}%</strong>
          </li>
          <li>
            <span>PRETTY</span>
            <strong>{prettyPercent}%</strong>
          </li>
          <li>
            <span>BRAIN</span>
            <strong>{brainPercent}%</strong>
          </li>
        </ul>
      </article>

      <article className="card">
        <h2 className="card-title">30 Day Calendar</h2>
        <div className="calendar">
          {calendarDays.map((date, index) => {
            const day = store.days[date] ?? emptyDay();
            const pretty = sectionProgress(prettyCards, day, now);
            const brain = sectionProgress(brainCards, day, now);
            const score = percent(pretty.done + brain.done, pretty.total + brain.total);
            const level = score === 0 ? 0 : score < 40 ? 1 : score < 75 ? 2 : 3;
            return (
              <button
                className={`day-cell level-${level} ${selectedDate === date ? "selected" : ""}`}
                key={date}
                type="button"
                onClick={() => {
                  selectDate(date);
                }}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </article>

      <article className="card">
        <div className="row-between">
          <h2 className="card-title">Study Planner</h2>
          <span className="badge">Selected Day</span>
        </div>

        <div className="planner-day planner-day-single">
          <div className="planner-sheet-head">
            <span className="sheet-pill">DATE</span>
            <span className="sheet-pill">D-DAY</span>
            <span className="sheet-pill">GOAL</span>
          </div>

          <div className="planner-sheet-body">
            <div className="planner-list-pane">
              <div className="panel-label">LIST</div>
              <div className="planner-list-lines">
                {readTodoList((store.days[selectedDate] ?? emptyDay()).record || {}).length > 0 ? (
                  readTodoList((store.days[selectedDate] ?? emptyDay()).record || {}).map((todo) => (
                    <div key={todo.id} className={`planner-list-item ${todo.done ? "done" : ""}`}>
                      <input
                        type="checkbox"
                        checked={todo.done}
                        onChange={(event) => {
                          event.stopPropagation();
                          toggleTodo(selectedDate, todo.id);
                        }}
                      />
                      <span>{todo.text}</span>
                      <button
                        type="button"
                        className="planner-delete-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeTodo(selectedDate, todo.id);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="planner-empty-list" />
                )}
              </div>
              <div className="planner-input-wrap">
                <input
                  className="planner-input"
                  value={todoDrafts[selectedDate] ?? ""}
                  onChange={(event) => setTodoDrafts((current) => ({ ...current, [selectedDate]: event.target.value }))}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      addTodo(selectedDate);
                    }
                  }}
                  placeholder="할 일 입력"
                />
                <button
                  type="button"
                  className="planner-add-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    addTodo(selectedDate);
                  }}
                >
                  추가
                </button>
              </div>
            </div>

            <div className="planner-timetable-pane">
              <div className="panel-label">TIME TABLE</div>
              <div className="planner-grid-head">
                {plannerMinuteCols.map((value) => (
                  <span key={`head-${value}`}>{value}</span>
                ))}
              </div>
              <div className="planner-legend">
                {timerTasks.map((task) => (
                  <span className="planner-legend-item" key={task.id}>
                    <span className="planner-legend-dot" style={{ background: taskColors[task.id] }} />
                    {task.name}
                  </span>
                ))}
              </div>
              <div className="planner-grid-body">
                {(() => {
                  const dayPlanner = getStudyPlannerForDay(store.days[selectedDate] ?? emptyDay(), now);
                  const segmentsByHour = buildPlannerSegments(dayPlanner.timeBlocks);
                  return plannerHourRows.map((row) => (
                    <div className="planner-grid-row" key={`${selectedDate}-${row}`}>
                      <span className="planner-row-label">{row}</span>
                      <div className="planner-row-track">
                        {(segmentsByHour[row] ?? []).map((segment, index) => (
                          <span
                            key={`${selectedDate}-${row}-${index}`}
                            className="planner-row-bar"
                            title={segment.label}
                            style={{ left: `${segment.leftPct}%`, width: `${segment.widthPct}%`, background: segment.color }}
                          />
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      </article>

      <article className="card">
        <h2 className="card-title">Habit Summary</h2>
        <ul className="summary-list">
          {habitSummary.map((habit) => (
            <li key={habit.label}>
              <span>{habit.label}</span>
              <strong>{calendarDays.filter((date) => habit.test(store.days[date] ?? emptyDay())).length} / 30</strong>
            </li>
          ))}
        </ul>
      </article>

      {bodyChanges.length > 0 && (
        <article className="card">
          <h2 className="card-title">Body Changes</h2>
          <ul className="summary-list">
            {bodyChanges.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <strong>
                  {item.first} → {item.last} cm
                </strong>
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}

function findFirstPhoto(store: Store, key: "facePhoto" | "bodyPhoto", beforeDate: string) {
  const dateKey = Object.keys(store.days)
    .sort()
    .find((date) => date < beforeDate && Boolean(store.days[date]?.record[key]));
  if (!dateKey) return null;
  return { dateKey, value: String(store.days[dateKey].record[key]) };
}

function RecordView({
  currentDay,
  update,
  handleImage,
  store,
  selectedDate,
}: {
  currentDay: DailyData;
  update: (section: keyof DailyData, key: string, value: Primitive) => void;
  handleImage: (event: ChangeEvent<HTMLInputElement>, key: "facePhoto" | "bodyPhoto") => void;
  store: Store;
  selectedDate: string;
}) {
  const measurements = [
    ["waist", "허리"],
    ["arm", "팔"],
    ["head", "머리"],
    ["thigh", "허벅지"],
    ["calf", "종아리"],
    ["chest", "가슴"],
  ] as const;

  const firstFace = findFirstPhoto(store, "facePhoto", selectedDate);
  const firstBody = findFirstPhoto(store, "bodyPhoto", selectedDate);

  return (
    <section className="section">
      <article className="card">
        <div className="row-between">
          <h2 className="card-title">Today's Photo</h2>
          <span className="badge">가이드라인 정렬</span>
        </div>
        <p className="card-subtitle">
          점선 가이드에 얼굴·몸 위치를 맞춰 찍으면 30일 후 변화를 비교하기 쉬워요.
        </p>
        <div className="photo-grid">
          <PhotoInput
            label="얼굴 사진"
            value={String(currentDay.record.facePhoto || "")}
            onChange={(event) => handleImage(event, "facePhoto")}
            reference={firstFace}
            startDate={store.startDate}
          />
          <PhotoInput
            label="몸 사진"
            value={String(currentDay.record.bodyPhoto || "")}
            onChange={(event) => handleImage(event, "bodyPhoto")}
            reference={firstBody}
            startDate={store.startDate}
          />
        </div>
      </article>

      <article className="card">
        <h2 className="card-title">Body Measurement</h2>
        <div className="two-col">
          {measurements.map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={String(currentDay.record[key] || "")}
                onChange={(event) => update("record", key, Number(event.target.value))}
                placeholder="cm"
              />
            </label>
          ))}
        </div>
      </article>

      <article className="card">
        <h2 className="card-title">Today's Note</h2>
        <label className="field">
          오늘의 느낀 점
          <textarea value={String(currentDay.record.note || "")} onChange={(event) => update("record", "note", event.target.value)} />
        </label>
      </article>
    </section>
  );
}

function PhotoInput({
  label,
  value,
  onChange,
  reference,
  startDate,
}: {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  reference: { dateKey: string; value: string } | null;
  startDate: string;
}) {
  return (
    <label className="photo-box">
      <span className="card-subtitle">{label}</span>
      <div className="preview">
        {value ? <img alt={label} src={value} /> : <span className="empty">사진 없음</span>}
        <PhotoGuideOverlay />
      </div>
      <input accept="image/*" type="file" onChange={onChange} />
      {reference && (
        <div className="photo-reference">
          <span className="photo-reference-label">DAY {String(getDayNumber(startDate, reference.dateKey)).padStart(2, "0")} 기록과 비교</span>
          <div className="photo-reference-thumb">
            <img alt={`${label} 첫 기록`} src={reference.value} />
            <PhotoGuideOverlay />
          </div>
        </div>
      )}
    </label>
  );
}

function PhotoGuideOverlay() {
  return (
    <svg className="photo-guide" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line x1="33.3" y1="0" x2="33.3" y2="100" />
      <line x1="66.6" y1="0" x2="66.6" y2="100" />
      <line x1="0" y1="33.3" x2="100" y2="33.3" />
      <line x1="0" y1="66.6" x2="100" y2="66.6" />
    </svg>
  );
}

function buildPlannerEntries(day: DailyData, now: number) {
  const entries: Array<{ id: string; label: string; title: string; start: number; end: number; active: boolean; color: string }> = [];

  allCards.forEach((card) => {
    const data = day[card.section];
    card.fields?.forEach((field) => {
      if (field.type !== "number" || !field.target) return;
      const sessions = readTimerSessions(data, field.key);
      if (sessions.length === 0 && readNumber(data[field.key]) <= 0) return;

      const activeSession = sessions.find((session) => !session.end);
      const start = activeSession ? Number(activeSession.start) : sessions.length ? Math.min(...sessions.map((session) => Number(session.start))) : 0;
      const end = activeSession ? now : sessions.length ? Math.max(...sessions.map((session) => Number(session.end ?? session.start))) : now;

      if (!start || !end) return;
      entries.push({
        id: `${card.id}-${field.key}`,
        label: field.label,
        title: card.title,
        start,
        end,
        active: Boolean(activeSession),
        color: categoryColors[card.section],
      });
    });
  });

  return entries.sort((a, b) => a.start - b.start);
}

function buildCardTimelineEntries(card: HabitCard, day: DailyData, now: number) {
  const data = day[card.section];
  const entries: Array<{ id: string; label: string; start: number; end: number; active: boolean; color: string }> = [];

  card.fields?.forEach((field) => {
    if (field.type !== "number" || !field.target) return;
    const sessions = readTimerSessions(data, field.key);
    if (sessions.length === 0 && readNumber(data[field.key]) <= 0) return;

    const activeSession = sessions.find((session) => !session.end);
    const start = activeSession ? Number(activeSession.start) : sessions.length ? Math.min(...sessions.map((session) => Number(session.start))) : 0;
    const end = activeSession ? now : sessions.length ? Math.max(...sessions.map((session) => Number(session.end ?? session.start))) : now;

    if (!start || !end) return;
    entries.push({ id: `${card.id}-${field.key}`, label: field.label, start, end, active: Boolean(activeSession), color: categoryColors[card.section] });
  });

  return entries;
}

function formatClock(value: number) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function safePostings(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      company: String(item.company || ""),
      role: String(item.role || ""),
      applied: Boolean(item.applied),
    }));
  } catch {
    return [];
  }
}

function getStudyPlannerForDay(day: DailyData, now: number) {
  const timeBlocks: Array<{ label: string; start: number; end: number; color: string }> = readSessions(day, "sessions")
    .filter((session) => session.startedAt > 0)
    .map((session) => ({
      label: session.taskName,
      start: session.startedAt,
      end: session.isRunning ? now : session.endedAt ?? now,
      color: taskColors[session.taskId] ?? categoryColors[session.category],
    }));

  const customTodos = readTodoList(day.record).map((item) => ({
    label: item.text,
    color: item.done ? "#bfe9d6" : "#e7d3ff",
  }));

  return { timeBlocks, todoBlocks: customTodos };
}

const plannerHourRows = [
  "07", "08", "09", "10", "11", "12", "13", "14", "15", "16",
  "17", "18", "19", "20", "21", "22", "23", "01", "02", "03",
];
const plannerMinuteCols = [0, 10, 20, 30, 40, 50];

type PlannerSegment = { leftPct: number; widthPct: number; color: string; label: string };

// 각 세션을 걸쳐 있는 시간(hour) 단위로 쪼개서, 분 단위 좌표(0~100%)를 가진 막대 조각으로 만든다.
function buildPlannerSegments(
  timeBlocks: Array<{ label: string; start: number; end: number; color: string }>,
): Record<string, PlannerSegment[]> {
  const segmentsByHour: Record<string, PlannerSegment[]> = {};

  timeBlocks.forEach((block) => {
    const blockEnd = Math.max(block.end, block.start + 60000);
    let cursor = new Date(block.start);

    while (cursor.getTime() < blockEnd) {
      const hourLabel = String(cursor.getHours()).padStart(2, "0");
      const hourStart = new Date(cursor);
      hourStart.setMinutes(0, 0, 0);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60000);

      const segStart = Math.max(block.start, hourStart.getTime());
      const segEnd = Math.min(blockEnd, hourEnd.getTime());

      if (plannerHourRows.includes(hourLabel) && segEnd > segStart) {
        const startMinutes = (segStart - hourStart.getTime()) / 60000;
        const endMinutes = (segEnd - hourStart.getTime()) / 60000;
        const list = segmentsByHour[hourLabel] ?? (segmentsByHour[hourLabel] = []);
        list.push({
          leftPct: (startMinutes / 60) * 100,
          widthPct: Math.max(((endMinutes - startMinutes) / 60) * 100, 1.2),
          color: block.color,
          label: block.label,
        });
      }

      cursor = hourEnd;
    }
  });

  return segmentsByHour;
}

function getBodyChanges(store: Store) {
  const labels: Record<string, string> = {
    waist: "허리",
    arm: "팔",
    head: "머리",
    thigh: "허벅지",
    calf: "종아리",
    chest: "가슴",
  };

  return Object.entries(labels).flatMap(([key, label]) => {
    const values = Object.keys(store.days)
      .sort()
      .map((date) => Number(store.days[date]?.record[key] || 0))
      .filter((value) => value > 0);

    if (values.length < 2) return [];
    return [{ label, first: values[0], last: values[values.length - 1] }];
  });
}
