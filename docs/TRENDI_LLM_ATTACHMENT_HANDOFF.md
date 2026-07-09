# Trendi LLM Attachment — Local Build Brief (Mac mini)

**Audience:** a local Claude Code / Codex session running **on the Mac mini** with the
Trendi iOS project and (if it exists) the Trendi backend checked out.

**Why this doc exists:** a remote session was asked to build the Coach LLM backend
proxy, but the Trendi code lives only on the Mac mini. This brief carries the full
task over so the local session can execute it without re-deriving requirements.
Nothing in this brief was verified against the actual Swift files — **the Swift code
is the source of truth for every schema detail below.**

---

## 0. Hard rules (non-negotiable)

- Do **not** put any LLM API key in the iOS app.
- Do **not** call the LLM provider directly from SwiftUI.
- Do **not** remove the local fallback path.
- Do **not** export an IPA or upload the app anywhere.
- Do **not** hardcode model names or API keys. Env/config only.
- Do **not** commit secrets. `.env` stays gitignored; ship `.env.example` with blank values.
- Do **not** print keys in logs. Redact `Authorization`-style headers everywhere.
- Do **not** touch unrelated projects in the workspace.
- Never report SAFE TO UPLOAD. Only **SAFE TO TEST**, and only after local backend + tests pass.

---

## 1. Recon before editing (do in this order)

### 1.1 Confirm the active iOS app
- Target: `CommandCenter` · Scheme: `CommandCenter` · Bundle ID: `app.aic.mobile` · Display name: `Trendi`.
- Verify with `xcodebuild -list -project <path>` (or `-workspace`) and the target's build
  settings / Info.plist. If multiple projects match, stop and confirm with the owner.

### 1.2 Locate the provider architecture
```
grep -rn "CoachGenerationProvider" --include="*.swift" <ios-repo-root>
```
Expected types: `CoachGenerationProvider` (protocol), `LocalCoachGenerationProvider`,
`RemoteLLMCoachGenerationProvider`, `MockCoachGenerationProvider`,
`CompositeCoachGenerationProvider`. Modes: local-only / remote / remoteWithFallback.

### 1.3 Extract the EXACT wire schema (single most important step)
From `RemoteLLMCoachGenerationProvider` and its payload types
(`RemoteCoachGenerationPayload`, `ResponsePayload`), record **verbatim**:

1. **Request:** every property name, Swift type, optionality; any `CodingKeys`
   renames; the `JSONEncoder` configuration — especially `keyEncodingStrategy`
   (camelCase vs `.convertToSnakeCase`) and date strategy.
2. **Response:** every field of `ResponsePayload`, nesting, optionality; the
   `JSONDecoder` configuration (`keyDecodingStrategy` decides the casing the
   backend must emit).
3. **Transport:** URL construction (does the app append `/v1/coach/generate/script`
   or expect the full URL in config?), HTTP method, headers, and the exact header
   name used for any client auth token.
4. **Failure contract:** which status codes / errors the provider surfaces as typed
   failures, and which conditions cause `CompositeCoachGenerationProvider` to fall
   back to local. The backend's error responses must land in the fallback-able bucket.
5. **Config keys:** exact names and read mechanism (scheme env vars, Info.plist,
   UserDefaults) for `COACH_GENERATION_MODE`, `COACH_LLM_ENDPOINT`,
   `COACH_LLM_API_KEY` — confirm spelling, don't assume.
6. **sourceMode:** the client stamps `sourceMode` locally. Only include it in the
   backend response if `ResponsePayload`'s decoder actually requires it.

Write the findings to `docs/coach-remote-schema.md` in the iOS repo **before**
writing any backend code.

### 1.4 Identify the backend home
Look for an existing backend/API app (Node/Next/Fastify/Express/Vapor/etc.): its
framework, routes directory, env system, package manager, scripts, deploy target.
- **If one exists:** add the route there, following its conventions.
- **If none exists:** create a small standalone TypeScript service (Fastify or Hono
  recommended — tiny, testable, easy timeout control) in its own folder/repo, not
  inside the iOS project.

---

## 2. Endpoint spec

`POST /v1/coach/generate/script` — `Content-Type: application/json`.

**Request body:** exactly the extracted `RemoteCoachGenerationPayload` shape.
Conceptual fields (names/casing per Swift, not per this list): idea, persona, goal,
pillars, platform, niche, audience, optional draft context, safety constraints,
requested output schema.

**Success response (200):** exactly the extracted `ResponsePayload` shape. Required
content fields:

| Field | Rule |
|---|---|
| `title` | non-empty string |
| `hook` | non-empty string |
| `recordableScript` | non-empty; human-recordable (see quality bar) |
| `showThis` | string |
| `onScreenText` | string |
| `caption` | string |
| `hashtags` | array of strings |
| `safetyNotes` | array of strings |
| `confidence` | number, clamped to a bounded range (e.g. 0–1) |

**Error responses:** predictable typed JSON, no stack traces, no provider internals:
```json
{ "error": { "code": "provider_timeout", "message": "Generation timed out." } }
```
Codes: `invalid_request` (400), `unsafe_request` (422), `provider_timeout` (504),
`provider_error` (502), `invalid_provider_response` (502). Verify every one of these
triggers clean local fallback in `CompositeCoachGenerationProvider`; adjust status
codes if the iOS provider's fallback logic expects something specific.

**Optional client auth:** if the app sends `COACH_LLM_API_KEY` in a header, support
verifying it against an env `CLIENT_AUTH_TOKEN`; skip verification when unset so
local dev works with an empty key. This is a client gate token — it is never the
LLM provider key.

---

## 3. LLM adapter

Clean server-side interface, e.g.:
```ts
interface CoachLLMAdapter {
  generate(prompt: CoachPromptInput, signal: AbortSignal): Promise<RawModelText>
}
```
Selected by env — no hardcoded providers/models/keys:

| Env var | Meaning |
|---|---|
| `LLM_PROVIDER` | `anthropic` \| `openai` \| `mock` (mock used by tests/local) |
| `LLM_MODEL` | model id, passed through verbatim |
| `LLM_API_KEY` | provider key — backend only, never logged, never echoed |
| `LLM_TIMEOUT_SECONDS` | request timeout (default ~30) |
| `LLM_BASE_URL` | optional override for proxies/self-hosted |
| `ALLOWED_CLIENT_ORIGIN` | optional CORS origin if browser-accessible |

Ask the model for **strict JSON** matching the response schema (tool/JSON-schema
forcing where the provider supports it), then parse + validate server-side anyway.

---

## 4. Prompt contract

Send the model **only**: user idea, creator profile fields present in the request,
platform, niche, audience, goal, selected draft context if present, safety
constraints, and the required JSON output schema.

Never send: debug state, provider internals, unrelated stored app data, credentials,
raw environment variables, unnecessary private data.

**Quality bar:** `recordableScript` must sound like something a real creator could
say on camera immediately. Never return:
- raw title stuffing, awkward noun slots, duplicated proper nouns, broken casing
- generic template sludge
- "looks simple from the outside" as a default fallback
- "people who actually deal with [topic]" as a default fallback
- provider/debug/internal language

**Calibration prompts** (must produce natural scripts; also use as test fixtures):
1. "I wanna go on vacation where should I go"
2. "They don't tell you how hard it is growing a tattoo page"
3. "Kendrick Lamar is the greatest"
4. "My hardest subject in school was math"
5. "I used to hate running"
6. "Something I learned too late"
7. "I sell beats"
8. "handmade candles"
9. "fitness coach"
10. "I make anime gym edits"

---

## 5. Safety gates

**Pre-LLM (deterministic, before any provider call):** reject with `unsafe_request`
(or safely reframe) requests involving guaranteed income, guaranteed weight loss,
guaranteed business results, fake testimonials, claiming results without proof, or
medical/legal/financial promises.

**Explicitly allowed** (do not over-block): refund policies, satisfaction
guarantees, normal product/service descriptions, personal opinions, creator
storytelling, music/pop-culture opinions, school/life reflection prompts.
("Satisfaction guaranteed" is fine; "guaranteed to make $10k" is not.)

**Post-LLM validation** — all must pass or return a safe structured fallback /
`invalid_provider_response`:
- valid JSON; all required fields exist
- `recordableScript` non-empty and not too generic
- `confidence` numeric and bounded
- `hashtags` and `safetyNotes` are arrays
- no internal/provider/debug language leaks (e.g. "as an AI", "mock", "provider",
  "fallback", "debug")
- none of the banned fallback phrases above appear

---

## 6. Timeout / failure behavior

- Abort the provider call at `LLM_TIMEOUT_SECONDS` → `provider_timeout`.
- Provider network/HTTP failure → `provider_error`.
- Unparseable/invalid model output → `invalid_provider_response` (or safe fallback).
- Log failures server-side without keys or full prompts; return clean typed errors.
- Every failure mode must leave the iOS app able to fall back locally with no
  user-facing error.

---

## 7. Tests (no live LLM calls anywhere)

1. Endpoint accepts a valid iOS payload (fixture built from the extracted schema).
2. Endpoint rejects malformed payload with `invalid_request`.
3. Mock LLM success → structured output with all required fields.
4. Mock LLM malformed response → safe error or fallback (never a 500 with a trace).
5. Mock LLM unsafe/banned-phrase response → blocked post-generation.
6. Pre-generation safety blocks unsafe prompts **before** the adapter is called
   (assert the mock was never invoked).
7. Each of the 10 calibration prompts returns a natural structured script (mock
   adapter returning realistic fixtures; assert banned phrases absent).
8. Key hygiene: set `LLM_API_KEY=TEST-SECRET-SENTINEL`, then assert the sentinel
   never appears in the serialized prompt, response body, captured logs, or test
   snapshots.
9. Timeout (mock adapter that never resolves) → `provider_timeout` within budget.
10. Integration: run the backend with `LLM_PROVIDER=mock`, point
    `RemoteLLMCoachGenerationProvider` at it (unit test with a local stub URL, or
    the simulator), and confirm the response decodes into `ResponsePayload`.

---

## 8. Local run + iOS integration

**Backend:**
```
cp .env.example .env        # LLM_PROVIDER=mock for first run; add real key later
<pkg-manager> install
<pkg-manager> run dev       # note the port
curl -s localhost:<port>/v1/coach/generate/script \
  -H 'content-type: application/json' -d @fixtures/valid-request.json
```

**iOS scheme env (CommandCenter scheme → Run → Arguments/Environment):**
- `COACH_GENERATION_MODE=remoteWithFallback`
- `COACH_LLM_ENDPOINT=http://localhost:<port>/v1/coach/generate/script`
- `COACH_LLM_API_KEY` empty unless a client token is implemented
- (Verify exact variable names against the Swift config reader first — step 1.3.5.)
- Simulator reaches `localhost` directly; a physical device needs the Mac's LAN IP.

**The LLM provider key lives only in the backend's `.env`. Never in the app.**

---

## 9. Manual QA checklist

1. Start backend locally (mock first, then real key if approved).
2. Configure iOS to `remoteWithFallback`.
3. Generate each of the 10 calibration prompts.
4. Confirm the visible Recordable Script is human-readable and on-camera speakable.
5. Kill the backend.
6. Generate again.
7. Confirm iOS falls back locally with **no user-facing error**.
8. Save to Vault. 9. Reuse from Vault. 10. Move into Today.
11. Confirm no provider/debug/internal language appears anywhere in the UI.

---

## 10. Report format (produce this at the end)

1. **SAFE TO TEST** or **NOT SAFE TO TEST** (never SAFE TO UPLOAD)
2. Backend route added
3. Request/response schema matched to iOS (cite the Swift files/lines)
4. LLM provider adapter added
5. Env/config instructions
6. Safety validation added
7. Tests added or updated
8. Test commands/results (paste real output)
9. Local run instructions
10. Remaining risks
11. What to verify next
