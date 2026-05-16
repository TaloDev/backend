# rejectedProps for Size-Exceeded Props

## Problem

When props fail size validation, the entire request fails with a 400 error. There's no way for clients to know which specific props were rejected or why — they just get a single error message. Meanwhile, the profanity filter already uses a `RejectedProp` pattern that gracefully reports which props were rejected and why, while still processing the valid ones.

## Solution

Refactor size validation to follow the same "accepted/rejected" pattern as profanity filtering. Props that exceed size limits go into `rejectedProps` instead of causing a full request error. The `RejectedProp` type gains machine-readable error codes so clients can distinguish rejection reasons programmatically.

**Out of scope:** The events endpoint (`POST /v1/events`) is excluded from this change. Events will continue to use the current `PropSizeError` throw pattern.

---

## Type Definitions

### New file: `src/lib/props/rejectedProp.ts`

All prop rejection types live here, not in the profanity utils.

```ts
export type PropRejectionReason =
  | 'PROP_KEY_TOO_LONG'
  | 'PROP_VALUE_TOO_LONG'
  | 'PROP_ARRAY_TOO_LONG'
  | 'PROP_CONTAINS_PROFANITY'

export type RejectedProp = {
  key: string
  error: PropRejectionReason
  message: string
}
```

`PropRejectionReason` is a union of known error codes:

| Code | Meaning |
|------|---------|
| `PROP_KEY_TOO_LONG` | Key exceeds `MAX_KEY_LENGTH` (128 chars) |
| `PROP_VALUE_TOO_LONG` | Value exceeds `MAX_VALUE_LENGTH` (512 chars, or custom limit) |
| `PROP_ARRAY_TOO_LONG` | Array prop exceeds `MAX_ARRAY_LENGTH` (1000 items) |
| `PROP_CONTAINS_PROFANITY` | Value contains profanity (when `blockPropsProfanity` is enabled) |

### `filterProfaneProps.ts`

Imports `RejectedProp` from `rejectedProp.ts` instead of defining it locally. Changes the profanity rejection to use the new shape:

```ts
// Before:
{ key, error: 'Prop value contains profanity' }
// After:
{ key, error: 'PROP_CONTAINS_PROFANITY', message: 'Prop value contains profanity' }
```

Function signature stays the same: `filterProfaneProps<T>(props, enabled): { accepted: T[]; rejected: RejectedProp[] }`.

### `put-storage.ts`

The local `FailedProp` type (`{ key: string; error: string }`) is replaced by `RejectedProp` from `rejectedProp.ts`. Error messages are updated from free-form strings to the new codes:

- Key too long → `{ key, error: 'PROP_KEY_TOO_LONG', message: '...' }`
- Value too long → `{ key, error: 'PROP_VALUE_TOO_LONG', message: '...' }`
- Array too long → `{ key, error: 'PROP_ARRAY_TOO_LONG', message: '...' }`

The `tryTestPropSize` wrapper is removed since `testPropSize` now returns `RejectedProp | null` directly.

### `propSizeError.ts`

Kept as-is for the events endpoint only. All other routes stop using it.

---

## Validation Changes

All validation functions become pure — they never throw. Size rejections are consistently returned as `rejectedProps` entries regardless of whether the route is API or dashboard.

### `testPropSize` — returns rejection instead of throwing

```ts
// Before:
export function testPropSize({ key, value, valueLimit }): void {
  // throws PropSizeError
}

// After:
export function testPropSize({ key, value, valueLimit }): RejectedProp | null {
  if (key.length > MAX_KEY_LENGTH) {
    return { key, error: 'PROP_KEY_TOO_LONG', message: `Prop key length (${key.length}) exceeds ${MAX_KEY_LENGTH} characters` }
  }
  const safeValueLimit = valueLimit || MAX_VALUE_LENGTH
  if (value && value.length > safeValueLimit) {
    return { key, error: 'PROP_VALUE_TOO_LONG', message: `Prop value length (${value.length}) exceeds ${safeValueLimit} characters` }
  }
  return null
}
```

### `hardSanitiseProps` — returns accepted/rejected

```ts
// Before:
export function hardSanitiseProps({ props, extraFilter, valueLimit }): Prop[]

// After:
export function hardSanitiseProps({ props, extraFilter, valueLimit }): {
  accepted: Prop[]
  rejected: RejectedProp[]
}
```

Iterates over sanitised props, calls `testPropSize` on each, collects rejections, and returns accepted `Prop` instances alongside rejected `RejectedProp` entries.

### `mergeAndSanitiseProps` — returns accepted/rejected

```ts
// Before:
export function mergeAndSanitiseProps({ prevProps, newProps, extraFilter, valueLimit }): Prop[]

// After:
export function mergeAndSanitiseProps({ prevProps, newProps, extraFilter, valueLimit }): {
  accepted: Prop[]
  rejected: RejectedProp[]
}
```

Array length checks (previously `throw PropSizeError`) become `RejectedProp` entries with `PROP_ARRAY_TOO_LONG`. Delegates to `hardSanitiseProps` which now returns its own rejections. Merges all rejections.

---

## Route Handler Changes

All prop-accepting routes (except events) change from try/catch on `PropSizeError` to the new accepted/rejected pattern. Every response includes `rejectedProps: RejectedProp[]` (always present, `[]` when nothing is rejected). This applies to both API and protected routes — the dashboard also receives `rejectedProps` instead of a 400 error.

### `player/update.ts` (shared handler)

This handler is used by both the protected route (dashboard) and the API route (forwarded). Both cases now use accepted/rejected. No more try/catch on `PropSizeError`.

```ts
// After:
const { accepted: sizeAccepted, rejected: sizeRejected } = mergeAndSanitiseProps(...)

if (forwarded && lockedPlayer.game.blockPropsProfanity) {
  const { accepted, rejected: profanityRejected } = filterProfaneProps(sizeAccepted, true)
  lockedPlayer.setProps(accepted)
  rejectedProps = [...sizeRejected, ...profanityRejected]
} else {
  lockedPlayer.setProps(sizeAccepted)
  rejectedProps = sizeRejected
}
```

The `errorMessage` field is removed from the return type since size errors now go into `rejectedProps`.

### `leaderboard/post.ts`

Both the create and update paths change to use `hardSanitiseProps`/`mergeAndSanitiseProps` returning accepted/rejected. Size rejections are appended to `rejectedProps` alongside profanity rejections. No more 400 error on size violation.

### `game-channel/put-storage.ts`

`tryTestPropSize` wrapper is removed. `testPropSize` is called directly, returning `RejectedProp | null`. The `FailedProp` type is replaced by `RejectedProp`. The response field `failedProps` is renamed to `rejectedProps` for consistency.

### Protected routes — `game/update.ts`, `game-channel/update.ts`, `game-channel/create.ts`

These routes currently catch `PropSizeError` and return `buildErrorResponse({ props: [err.message] })`. They change to use the accepted/rejected pattern. Size rejections go into `rejectedProps` in the 200 response body instead of causing a 400 error. The PropSizeError try/catch blocks are removed.

### `game-feedback/post.ts`

This is an API route using `hardSanitiseProps` directly. Changes to use the accepted/rejected return pattern. Size rejections go into `rejectedProps` in the 200 response body.

---

## API Response Shape

All routes (API and protected) now return 200 with `rejectedProps` on size validation failures instead of 400.

### Before (size error — 400)

```json
{
  "error": {
    "props": ["Prop key length (150) exceeds 128 characters"]
  }
}
```

### After (size error — 200)

```json
{
  "player": { ... },
  "rejectedProps": [
    { "key": "some_very_long_key_name...", "error": "PROP_KEY_TOO_LONG", "message": "Prop key length (150) exceeds 128 characters" }
  ]
}
```

Both API and protected routes return 200 with the entity in its updated state (only valid props applied) and `rejectedProps` listing what was rejected and why. `rejectedProps` is always present in the response, defaulting to `[]`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/props/rejectedProp.ts` | **New.** `RejectedProp` type, `PropRejectionReason` type |
| `src/lib/props/sanitiseProps.ts` | `testPropSize` returns `RejectedProp \| null`. `hardSanitiseProps` and `mergeAndSanitiseProps` return `{ accepted, rejected }`. No longer throw |
| `src/lib/props/filterProfaneProps.ts` | Remove local `RejectedProp` type. Import from `rejectedProp.ts`. Use `PROP_CONTAINS_PROFANITY` code |
| `src/routes/api/game-channel/put-storage.ts` | Remove `FailedProp` type and `tryTestPropSize`. Import `RejectedProp`. Rename `failedProps` → `rejectedProps` |
| `src/routes/protected/player/update.ts` | Remove `PropSizeError` try/catch. Use accepted/rejected from `mergeAndSanitiseProps`. Return `rejectedProps` for both forwarded and non-forwarded calls |
| `src/routes/api/player/patch.ts` | No changes needed (delegates to `updatePlayerHandler`) |
| `src/routes/protected/game/update.ts` | Remove `PropSizeError` try/catch. Use accepted/rejected from `mergeAndSanitiseProps`. Return `rejectedProps` in 200 response |
| `src/routes/protected/game-channel/update.ts` | Remove `PropSizeError` try/catch. Use accepted/rejected from `mergeAndSanitiseProps`. Return `rejectedProps` in 200 response |
| `src/routes/protected/game-channel/create.ts` | Remove `PropSizeError` try/catch. Use accepted/rejected from `hardSanitiseProps`. Return `rejectedProps` in 200 response |
| `src/routes/api/game-feedback/post.ts` | Remove `PropSizeError` try/catch. Use accepted/rejected from `hardSanitiseProps`. Return `rejectedProps` in 200 response |
| `src/routes/api/leaderboard/post.ts` | Remove `PropSizeError` try/catch. Use accepted/rejected from `hardSanitiseProps`/`mergeAndSanitiseProps`. Merge size rejections with profanity rejections into `rejectedProps` |

**Not changed:**
- `src/routes/api/event/post.ts` — Events out of scope, keeps current throw pattern
- `src/lib/errors/propSizeError.ts` — Kept for events, no changes