# PT 예약 시스템 개편 계획

회원이 직접 예약하던 방식을 **트레이너/관리자가 일정을 등록**하고 **회원은 변경만 요청**하는 실제 PT 운영 방식으로 변경합니다.

---

## 1. DB 변경 (마이그레이션)

### 신규 테이블

**`trainer_availability`** — 트레이너 요일별 가능 시간대
- `trainer_id` (uuid, FK 개념)
- `weekday` (0~6, 일~토)
- `start_time` (text, "06:00")
- `end_time` (text, "14:00")

**`trainer_time_off`** — 트레이너 휴무일
- `trainer_id` (uuid)
- `date` (date)
- `reason` (text, optional)

### RLS 정책
- 트레이너: 본인 데이터 CRUD
- 관리자: 전체 CRUD
- 회원: 모든 트레이너 가용성 조회 가능 (변경 요청 시 필요)

---

## 2. 트레이너 화면

### 신규 페이지: `/admin/my-schedule` (내 스케줄 설정)
- **요일별 가능 시간대**: 월~일 각각 시작/종료 시간 입력 (다중 슬롯 지원)
- **휴무일 등록**: 날짜 선택 + 사유 입력, 목록 표시 / 삭제
- **미니 캘린더**: 향후 30일을 색으로 표시
  - 🟢 초록: 가능
  - 🔴 빨강: 휴무
  - ⚫ 회색: 예약 있음

### 사이드바 메뉴 추가
- 트레이너 역할일 때 "내 스케줄 설정" 항목 추가

---

## 3. 일정 등록 주체 변경

### 트레이너/관리자 일정 등록 (기존 UI 유지)
- `admin.index.tsx` MonthTimeline에서 일정 추가/편집 시
- **저장 직후 회원에게 알림 자동 발송**:
  - `notifications` insert: "다음 PT 일정이 등록되었습니다. N월 N일 N시"
- 회원 화면의 직접 예약 기능은 **제거**

---

## 4. 회원 화면 변경

### `/member/booking` → `/member/my-schedule` (내 일정)
- 라우트 파일명 유지하되 UI/내용 교체 (라우트 트리 영향 최소화)
- **상단 탭/네비**: "예약" → "내 일정"으로 라벨 변경
- **목록**: 내 향후 PT 일정 카드 형태로 표시
  - 날짜 / 시간 / 트레이너명
  - **"변경 요청" 버튼만 노출** (취소 신청 버튼 제거 또는 유지는 기존 로직 따름)

### 변경 요청 다이얼로그
- 원하는 **날짜 선택 (캘린더)**
  - 트레이너 휴무일·가용성 없는 요일은 disabled
- **시간 슬롯 표시**: 해당 날짜 해당 트레이너의 가용 시간만 30분 단위 버튼
  - 이미 예약된 슬롯은 disabled (회색)
- 수업 1일 전 마감 가드 (기존 `isAtLeastOneDayAhead` 재사용)
- 제출 → `schedule_requests` insert (type: "change") + 트레이너 알림

---

## 5. 변경 요청 승인 흐름 (기존 활용)

기존 `admin.requests.tsx`에서 처리되고 있으므로:
- 트레이너 승인/거절 후 회원에게 결과 알림 발송 로직 확인/보강
- 1일 전 마감은 회원 측 가드로 충분

---

## 6. 영향 파일

**DB**
- `supabase/migrations/...` — 신규 테이블 2개 + RLS

**신규**
- `src/routes/_app/admin.my-schedule.tsx` — 트레이너 스케줄 설정
- `src/lib/availability.ts` — 가용성 계산 헬퍼 (날짜 → 가능 슬롯)

**수정**
- `src/components/app-sidebar.tsx` — 트레이너 메뉴 항목 추가
- `src/components/month-timeline.tsx` — 일정 저장 시 회원 알림 발송
- `src/routes/member.booking.tsx` — "내 일정" 화면으로 전면 교체
- `src/routes/member.tsx` (탭 라벨) — "예약" → "내 일정"
- `src/routes/_app/admin.requests.tsx` — 승인/거절 시 회원 알림 보강

**유지**
- 기존 RLS / 알림 / 인증 구조

---

## 기술 메모

- 가용성 슬롯 생성: `start_time`~`end_time`을 30분 간격으로 분할
- 회원이 트레이너 가용성 조회: `trainer_availability` SELECT 정책 = `authenticated` 모두 허용
- 시간 충돌 검증: 클라이언트에서 기존 `schedules` + 신청 중 `schedule_requests` 둘 다 체크
- UI 컴포넌트: 기존 shadcn `Calendar`, `Dialog`, `Button` 등 재사용 — 새 디자인 토큰 도입 없음
