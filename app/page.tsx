"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Tab = "today" | "dashboard" | "record";
type SectionName = "pretty" | "brain";
type Primitive = string | number | boolean;

type DailyData = {
  pretty: Record<string, Primitive>;
  brain: Record<string, Primitive>;
  record: Record<string, Primitive>;
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

const storageKey = "prettyna-store-v1";
const dayMs = 1000 * 60 * 60 * 24;
const timerStartSuffix = "_started_at";

const resources = {
  guaSha: "https://www.youtube.com/results?search_query=face+gua+sha+routine",
  cardio: "https://www.youtube.com/results?search_query=30+minute+cardio+workout",
  strength: "https://www.youtube.com/results?search_query=30+minute+strength+workout",
  voice: "https://www.youtube.com/results?search_query=voice+training+practice",
  english: "https://learnenglish.britishcouncil.org/",
  opic: "https://www.youtube.com/results?search_query=OPIc+practice",
  data: "https://www.kaggle.com/learn",
};

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
    subtitle: "식단 조건 체크",
    section: "pretty",
    checks: [
      { key: "no_food_after_7", label: "오후 7시 이후 음식 먹지 않기" },
      { key: "snack_limit", label: "간식 최대 작은 봉지 2개" },
      { key: "diet_meal", label: "하루 한 끼 이상 식단용 음식 포함" },
      { key: "no_delivery", label: "배달음식 / 음식 구매하지 않기" },
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
    subtitle: "면접, 회사 공부, 채용공고, 인적성",
    section: "brain",
    fields: [
      { key: "interview_minutes", label: "면접 준비 시간", type: "number", target: 30 },
      { key: "interview_prepared", label: "오늘 준비한 것", type: "textarea" },
      { key: "interview_feeling", label: "느낀 점", type: "textarea" },
      { key: "company_name", label: "회사명", type: "text" },
      { key: "company_minutes", label: "회사 공부 시간", type: "number", target: 20 },
      { key: "company_note", label: "간략한 정리", type: "textarea" },
      { key: "aptitude_minutes", label: "인적성 공부 시간", type: "number" },
      { key: "aptitude_note", label: "공부한 영역 / 내용", type: "textarea" },
    ],
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
  return { pretty: {}, brain: {}, record: {} };
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

function elapsedMinutes(data: Record<string, Primitive>, key: string, now = Date.now()) {
  const savedMinutes = readNumber(data[key]);
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
  const prettyProgress = sectionProgress(prettyCards, currentDay, now);
  const brainProgress = sectionProgress(brainCards, currentDay, now);
  const totalDone = prettyProgress.done + brainProgress.done;
  const totalItems = prettyProgress.total + brainProgress.total;
  const todayPercent = percent(totalDone, totalItems);
  const prettyPercent = percent(prettyProgress.done, prettyProgress.total);
  const brainPercent = percent(brainProgress.done, brainProgress.total);
  const dayNumber = getDayNumber(store.startDate, selectedDate);

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

  function handleImage(event: ChangeEvent<HTMLInputElement>, key: "facePhoto" | "bodyPhoto") {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("record", key, String(reader.result || ""));
    reader.readAsDataURL(file);
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
            <p className="day">DAY {String(dayNumber).padStart(2, "0")} / 30</p>
            <p className="today-score">TODAY {todayPercent}%</p>
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
        <>
          <section className="section">
            <h2 className="section-title">💗 PRETTY</h2>
            <div className="section-grid">{prettyCards.map((card) => renderHabitCard(card, currentDay, update, now))}</div>
          </section>

          <section className="section">
            <h2 className="section-title">🧠 BRAIN</h2>
            <div className="section-grid">{brainCards.map((card) => renderHabitCard(card, currentDay, update, now))}</div>
            <JobPostings
              items={safePostings(String(currentDay.brain.job_postings || "[]"))}
              onAdd={addPosting}
              onChange={updatePosting}
              onRemove={removePosting}
            />
          </section>
        </>
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
        />
      )}

      {tab === "record" && (
        <RecordView currentDay={currentDay} update={update} handleImage={handleImage} />
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
) {
  const progress = cardProgress(card, currentDay, now);
  const score = percent(progress.done, progress.total);
  const data = currentDay[card.section];
  const isDone = progress.total > 0 && progress.done === progress.total;
  const visibleChecks = card.id === "grooming" && !data.grooming_needed ? [] : card.checks;

  return (
    <article className={`card ${isDone ? "done" : ""}`} key={card.id}>
      <div className="card-head">
        <div>
          <h3 className="card-title">{card.title}</h3>
          {card.subtitle && <p className="card-subtitle">{card.subtitle}</p>}
        </div>
        <span className="badge">{progress.total === 0 ? "제외" : `${score}%`}</span>
      </div>

      {card.resource && (
        <a className="resource-link" href={resources[card.resource]} target="_blank" rel="noreferrer">
          자료 보기
        </a>
      )}

      {card.fields && (
        <div className="fields">
          {card.fields.map((field) => (
            <FieldControl
              field={field}
              key={field.key}
              now={now}
              startedAt={data[startedAtKey(field.key)]}
              value={data[field.key]}
              onChange={(value) => update(card.section, field.key, value)}
              onStartedAtChange={(value) => update(card.section, startedAtKey(field.key), value)}
            />
          ))}
        </div>
      )}

      {visibleChecks && visibleChecks.length > 0 && (
        <div className="checks">
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
    </article>
  );
}

function FieldControl({
  field,
  now,
  startedAt,
  value,
  onChange,
  onStartedAtChange,
}: {
  field: FieldItem;
  now: number;
  startedAt: Primitive | undefined;
  value: Primitive | undefined;
  onChange: (value: Primitive) => void;
  onStartedAtChange: (value: Primitive) => void;
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
        now={now}
        startedAt={startedAt}
        value={value}
        onChange={onChange}
        onStartedAtChange={onStartedAtChange}
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
  now,
  startedAt,
  value,
  onChange,
  onStartedAtChange,
}: {
  field: FieldItem;
  now: number;
  startedAt: Primitive | undefined;
  value: Primitive | undefined;
  onChange: (value: Primitive) => void;
  onStartedAtChange: (value: Primitive) => void;
}) {
  const baseMinutes = readNumber(value);
  const startTime = readNumber(startedAt);
  const running = startTime > 0;
  const currentMinutes = startTime ? baseMinutes + Math.max(0, now - startTime) / 60000 : baseMinutes;
  const reached = currentMinutes >= (field.target || 0);

  function start() {
    if (running) return;
    onStartedAtChange(Date.now());
  }

  function pause() {
    if (!running) return;
    onChange(currentMinutes);
    onStartedAtChange(0);
  }

  function reset() {
    onChange(0);
    onStartedAtChange(0);
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
}) {
  const bodyChanges = getBodyChanges(store);

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
                  setTab("today");
                }}
              >
                {index + 1}
              </button>
            );
          })}
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

function RecordView({
  currentDay,
  update,
  handleImage,
}: {
  currentDay: DailyData;
  update: (section: keyof DailyData, key: string, value: Primitive) => void;
  handleImage: (event: ChangeEvent<HTMLInputElement>, key: "facePhoto" | "bodyPhoto") => void;
}) {
  const measurements = [
    ["waist", "허리"],
    ["arm", "팔"],
    ["head", "머리"],
    ["thigh", "허벅지"],
    ["calf", "종아리"],
    ["chest", "가슴"],
  ] as const;

  return (
    <section className="section">
      <article className="card">
        <h2 className="card-title">Today's Photo</h2>
        <div className="photo-grid">
          <PhotoInput label="얼굴 사진" value={String(currentDay.record.facePhoto || "")} onChange={(event) => handleImage(event, "facePhoto")} />
          <PhotoInput label="몸 사진" value={String(currentDay.record.bodyPhoto || "")} onChange={(event) => handleImage(event, "bodyPhoto")} />
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
}: {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="photo-box">
      <span className="card-subtitle">{label}</span>
      <div className="preview">{value ? <img alt={label} src={value} /> : <span className="empty">사진 없음</span>}</div>
      <input accept="image/*" type="file" onChange={onChange} />
    </label>
  );
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
