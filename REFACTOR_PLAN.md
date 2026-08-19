# PRETTINA 핵심 기능 재설계 구현 계획

## 1. 새로운 데이터 구조

### TaskSession 타입
```typescript
type TaskSession = {
  id: string;
  taskId: string;
  taskName: string;
  category: "pretty" | "brain";
  goalMinutes: number;
  startedAt: number;  // timestamp
  endedAt?: number;   // timestamp
  isRunning: boolean;
}
```

### Store 확장
```
Store에 sessions 필드 추가:
days[dateKey]: {
  pretty: { ... },
  brain: { ... },
  record: { ... },
  sessions: TaskSession[]  // NEW
}
```

## 2. Timer Task 정의

### PRETTY (6개 task)
- morning_gua_sha: 10분
- evening_gua_sha: 10분
- cardio: 30분
- strength: 30분

### BRAIN (8개 task)
- news: 20분
- common_knowledge: 20분
- interview_prep: 30분
- data_study: 30분
- project: 20분
- language: 30분
- opic: (timer 사용 가능)
- voice: 10분

## 3. 화면 재설계

### Today
- 상단: 타이머 Tasks만 표시 (compact)
- 형식: 
  ```
  데이터 공부
  30분 목표
  
  00:18:32
  
  [ ▶ 시작 ]  or  [ ■ 종료 ]
  
  오늘 공부한 내용 >
  ```

### Dashboard
- 제거: Study Stopwatch 영역의 모든 입력 필드
- 추가: Time Table (기록 기반)
- 유지: Progress, Calendar, Habit Summary, Body Changes

## 4. 구현 단계

### Phase 1: Type & Data (완료해야함)
- TaskSession 타입 추가
- Timer Task 배열 추가
- Store에 sessions 필드 추가

### Phase 2: Today 화면 (우선순위 높음)
- 새로운 Timer Task UI 컴포넌트
- Start/Stop 로직
- 동시 실행 방지

### Phase 3: Time Table (우선순위 높음)
- Dashboard Time Table 구현
- 실시간 표시
- 분 단위 위치 반영

### Phase 4: 기존 기능 유지
- Habit cards 유지
- Record 기능 유지
- 데이터 마이그레이션

## 5. 테스트 시나리오

```
1. Today → 데이터 공부 → ▶ 시작
2. 5분 대기
3. Dashboard 이동 → Time Table에 진행 중 블록 표시
4. Today 복귀 → Timer 계속 실행
5. ■ 종료
6. Dashboard → 기록 확정
7. 새로고침 → 기록 유지
```

## 6. 주의사항

- localStorage 호환성 유지
- 기존 데이터 마이그레이션 또는 기본값 처리
- 동시 timer 실행 불가
- 페이지 백그라운드 시에도 정확한 시간 계산
