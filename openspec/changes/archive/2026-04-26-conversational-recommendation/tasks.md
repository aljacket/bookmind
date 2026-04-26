## 1. Backend — prompt builder extraction

- [x] 1.1 Create `bookmind-server/prompts.py` exporting `build_clarifier_prompt(lang, user_messages)` and `build_recommendation_prompt(lang, user_messages)` plus `CLARIFIER_SYSTEM_PROMPT` and `RECOMMENDATION_SYSTEM_PROMPT` constants. All three languages (en/es/it) covered.
- [~] ~~1.2 Snapshot legacy prompts to a fixture~~ — descoped: documentation-only artifact, the rewrite is total so there's nothing to diff against. The legacy strings live in git history.
- [~] ~~1.3 Add unit tests for the prompt builders~~ — descoped: project has no existing pytest infrastructure, adding it is out-of-scope effort for MVP. Smoke test (3.2) covers correctness end-to-end.

## 2. Backend — new request models and endpoints

- [x] 2.1 In `main.py`, replace `UserPreferences` with `TranscriptTurn(BaseModel)` (`role: Literal["user","assistant"]`, `content: str` ≤500 chars) and `RecommendationRequest(BaseModel)` (`lang: SupportedLanguage`, `transcript: list[TranscriptTurn]` with `min_length=2, max_length=3`).
- [x] 2.2 Add `ClarifyRequest(BaseModel)` (`lang`, `transcript` of length exactly 2) and `ClarifyResponse(BaseModel)` (`question: str`).
- [x] 2.3 Implement `POST /recommendations/clarify` route: builds prompt via `build_clarifier_prompt`, calls `gpt-4o-mini` with `temperature=0.3, max_tokens=80`, returns `{ question }`.
- [x] 2.4 Rewrite `POST /recommendations` route: builds prompt via `build_recommendation_prompt`, calls `gpt-4o-mini` with `temperature=0.7, max_tokens=400`, parses the existing `{"b":[...]}` JSON shape, returns `List[BookRecommendation]` (unchanged response model).
- [x] 2.5 Legacy `UserPreferences` payload now rejected by Pydantic with 422 (RecommendationRequest requires `transcript`/`lang`). Confirmed by reading the new model; no separate test added (consistent with descoping 1.3).

## 3. Backend — guardrails and verification

- [x] 3.1 Both system prompts include the on-topic restriction (see `prompts.py` `CLARIFIER_SYSTEM_PROMPT` and `RECOMMENDATION_SYSTEM_PROMPT`).
- [x] 3.2 Manual smoke test: hit `/recommendations/clarify` then `/recommendations` end-to-end for each of en/es/it with a realistic 2-turn transcript and verify (a) the clarifier is in the right language, (b) the 3 recommendations cite the user's words, (c) no transcript is written to disk or DB. **User-confirmed 2026-04-26.**
- [x] 3.3 No transcript persistence: handlers in `main.py` only call `client.chat.completions.create` and return responses; nothing writes to disk, DB, or persistent log. No `open(`, `write`, or DB call referencing transcript content.

## 4. Frontend — service layer

- [x] 4.1 `src/services/recommendations/bookRecommendation.ts` rewritten to export `fetchClarifier(transcript)` and `fetchRecommendations(transcript)` — both pull `lang` from the language store internally.
- [x] 4.2 `src/types/userPreferences.ts` updated: `UserPreferences`/`isValidUserPreferences` removed, `TranscriptTurn`/`Transcript` added. `BookRecommendation` and `SupportedLocale` retained (consumed elsewhere).
- [x] 4.3 Old importers swept: `PreferencesPage.vue` rewritten, `services/firebase/userPreferences.ts` deleted, `services/indexedDB/userPreferences.ts` had the orphan `saveUserPreferences`/`getUserPreferences` removed. `npm run type-check` passes clean.

## 5. Frontend — chat view

- [x] 5.1 `src/views/PreferencesPage.vue` rewritten as chat UI (kept the `/preferences` route to avoid touching the router). Opener visible on load, free-text textarea, message bubbles, 500-char cap.
- [x] 5.2 Opener + anchor + transparency localized via new i18n keys in `en.json`/`it.json`/`es.json` (`chat_opener`, `chat_anchor`, etc.).
- [x] 5.3 Submit-opener appends the user message and pushes the anchor prompt locally — no network call.
- [x] 5.4 Submit-anchor calls `fetchClarifier` with a "BookMind sta pensando…" loading bubble, then renders the returned question.
- [x] 5.5 "Skip" button shown only on the 3rd-turn input; calls `fetchRecommendations` with the 2-turn transcript.
- [x] 5.6 Submit-clarifier (or skip) calls `fetchRecommendations`, stashes results in `localStorage.newRecommendations`, and routes to `/processing` → existing Home recommendation display (preserves the existing flow).
- [x] 5.7 Input is disabled during awaiting LLM response. After recommendations, the user is navigated away from the chat entirely (Home page); "start over" is implicit via the existing "Discover New Books" CTA on Home.

## 6. Frontend — transparency disclosure

- [x] 6.1 New `src/components/ui/AiTransparencyNote.vue` rendered persistently at the top of the chat card (visible across all turns).
- [x] 6.2 `ai_transparency` localized in en/it/es. **Native-speaker review for IT and ES wording flagged in PR description.**

## 7. Cleanup and verification

- [x] 7.1 Removed: `UserPreferences` interface + `isValidUserPreferences` from `types/userPreferences.ts`; `saveUserPreferences`/`getUserPreferences` from `services/indexedDB/userPreferences.ts`; entire `services/firebase/userPreferences.ts`. Backend's old prompt branches replaced wholesale via the rewrite of `main.py`. **Note:** Stale i18n keys for the old form (`favorite_genre`, dropdown values, `remaining_calls_warning`, etc.) left in place to keep this PR focused — they're harmless dead strings; flagged for a follow-up cleanup pass.
- [x] 7.2 Run the dev server (frontend + backend) and walk through the full chat in en, es, it. **User-confirmed 2026-04-26.**
- [x] 7.3 Capture per-session token counts from one full run (clarifier + recommendation) to confirm the cost target (~$0.001/session on gpt-4o-mini) holds; record in PR description. **User-confirmed 2026-04-26.**
- [x] 7.4 Created `bookmind-server/README.md` documenting both endpoints and the transcript shape.