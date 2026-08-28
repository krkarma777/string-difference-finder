# @krkarma777/string-diff — Myers O(ND) 기반 npm 패키지 설계

날짜: 2026-08-28
상태: 승인됨 (Spring 제거 조건 포함)

## 목표

기존 Spring Boot 웹 데모의 Hirschberg LCS 알고리즘(O(N×M))을 **Myers O(ND) 최단 편집
스크립트 알고리즘 + 선형 공간 divide & conquer**로 완전히 교체하고, 의존성 0개의
TypeScript npm 패키지 `@krkarma777/string-diff`로 배포한다.

## 범위

- **리포 전환**: Spring Boot 앱(Gradle, Java, templates, static)을 전부 제거하고
  리포 루트를 npm 패키지로 전환한다.
- **데모 보존**: 기존 웹 UI는 정적 `demo/index.html` 한 장으로 대체하며, 빌드된
  IIFE 번들을 사용한다.
- **배포**: 테스트/벤치마크 통과 후 `npm publish --access public` 시도.
  (npm 미로그인 상태면 로그인 안내 후 종료.)

## 알고리즘 설계

### 파이프라인

```
diff(a, b, options)
  1. 토큰화 (word | char | line)
  2. 토큰 인터닝: string → int ID, Int32Array 두 개 생성
  3. 공통 접두사/접미사 제거 (정수 비교, O(N))
  4. Myers 선형 공간 D&C (middle snake) — 편집 영역 산출
  5. 후처리: 인접 동일 op 병합, 원본 토큰 문자열로 복원
```

### Myers 코어 (`src/myers.ts`)

- Myers(1986)의 greedy 최단 편집 스크립트 탐색. 시간 O((N+M)·D), 공간 O(N+M).
- 선형 공간을 위해 forward/backward 탐색으로 middle snake를 찾고 양쪽을 재귀 분할.
- V 배열은 `Int32Array` 스크래치 버퍼 2개(forward/backward)를 **최초 1회만 할당**하고
  전체 재귀에서 재사용한다 (재귀 호출은 순차 실행이므로 안전).
- 재귀 내부에서도 각 구간의 공통 접두/접미(snake)를 우선 소진한다.
- 결과는 항상 최단 편집 스크립트(최적해). 휴리스틱 절단 없음.
- 완전 동기 실행. 기존 코드의 `Promise.all` 기반 가짜 병렬화는 제거한다
  (싱글 스레드 JS에서 이득 없음).

### 토크나이저 (`src/tokenize.ts`)

- `word` (기본): `/[\p{L}\p{M}\p{N}_]+|\s+|[^\s\p{L}\p{M}\p{N}_]+/gu` —
  유니코드 문자 속성 기반. 기존 `\w` 정규식은 ASCII 전용이라 한국어 문장 전체가
  한 토큰이 되는 문제가 있었고, 이를 수정한다.
- `char`: `[...str]` 코드 포인트 단위 (서로게이트 페어 안전).
- `line`: `\n` 뒤에서 분할, 줄 종결자는 토큰에 포함.

### 공개 API (`src/index.ts`)

```ts
type DiffOperation = 'equal' | 'insert' | 'delete';
interface DiffEntry { operation: DiffOperation; text: string; }
interface DiffOptions { mode?: 'word' | 'char' | 'line'; } // 기본 'word'

function diff(a: string, b: string, options?: DiffOptions): DiffEntry[];
function diffTokens(a: readonly string[], b: readonly string[]): DiffEntry[];
```

- 출력 규약: 변경 구간 내에서는 delete가 insert보다 먼저 온다.
  인접한 동일 operation은 하나로 병합된다.
- `diff(a, a)`는 `[{ operation: 'equal', text: a }]` (빈 문자열이면 `[]`).

## 패키지 구조

```
package.json        @krkarma777/string-diff v1.0.0, MIT, type: module
tsconfig.json
tsup.config.ts      ESM + CJS + IIFE(StringDiff 전역) + .d.ts
src/
  index.ts          공개 API, 토큰화+인터닝+후처리 결합
  tokenize.ts
  myers.ts
test/               node:test (Node 24 네이티브 TS 실행, 테스트 의존성 0)
  tokenize.test.ts
  diff.test.ts      기본 동작, 경계, 유니코드/한국어
  invariants.test.ts  퍼징 + 최적성 검증
bench/
  legacy-hirschberg.mjs  기존 diff.js 알고리즘 포팅 (비교 기준)
  bench.mjs              시나리오별 old vs new 비교
demo/index.html     정적 데모 (dist의 IIFE 번들 로드)
README.md           영문, 벤치마크 수치 포함
LICENSE             MIT
```

- devDependencies: `typescript`, `tsup` 2개만. 런타임 의존성 0.
- `files: ["dist"]`, `sideEffects: false`, `publishConfig.access: "public"`.
- exports 맵: types / import / require. engines: node >= 16.

## 검증 전략

1. **왕복 불변식 (퍼징)**: 랜덤 (a,b) 수백 쌍 × {word,char,line} 모드에 대해
   - equal+delete 텍스트 결합 == a
   - equal+insert 텍스트 결합 == b
2. **최적성**: 소형 입력(토큰 ≤ 40)에서 레퍼런스 O(N×M) DP로 LCS 길이 L을 구해
   Myers 결과의 delete 토큰 수 == N−L, insert 토큰 수 == M−L 인지 확인.
3. **경계 케이스**: 빈 문자열, 동일 문자열, 완전 상이, 접두/접미만 공통, 단일 토큰.
4. **유니코드**: 한국어 단어 diff, 이모지(서로게이트 페어) char diff.

퍼징 난수는 시드 고정 LCG를 사용해 재현 가능하게 한다.

## 벤치마크

`bench/bench.mjs`가 두 구현을 동일 입력으로 실행, 중앙값 비교:

1. 대형 텍스트(수십 KB)에 소량 단어 편집 — 전형적 사용
2. 동일한 대형 텍스트
3. 완전히 다른 중형 텍스트 — Myers 최악 케이스(D 큼) 정직하게 공개
4. 코드 파일 편집 시뮬레이션

결과 표를 README에 수록한다.

## 비목표 (YAGNI)

- patience/histogram diff, 의미론적 정리(semantic cleanup), patch 생성/적용,
  스트리밍, Web Worker 병렬화, CLI 바이너리.

## 배포 절차

1. 전체 테스트 통과 + `npm run build` 성공 + 벤치마크 실행
2. `npm publish --access public` (prepublishOnly에서 build+test 자동 실행)
3. 미로그인(E401) 시: `npm login` 안내 후, 로그인만 하면 재시도 가능한 상태로 마무리
