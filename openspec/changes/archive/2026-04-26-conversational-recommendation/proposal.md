## Why

The current form-based recommendation flow (6 fixed dropdowns sent verbatim to GPT-4o-mini) treats the LLM as a glorified key-value lookup and produces results indistinguishable from a static database. Web research into the 2025–2026 competitive landscape confirms a real opening: StoryGraph's tag-based mood engine is degrading at scale (users complain of irrelevant romantasy/erotica recommendations), Fable burned its credibility in January 2025 by shipping racially biased AI summaries and was forced to pull all generative AI, and Goodreads' algorithm still recommends already-read books on a 2006 UI. Meanwhile r/suggestmeabook posts and BookTok discovery share one shape — a short narrative request anchored on a loved book and a current mood — that no Western app handles conversationally today. This change replaces the form with a 2–3 turn guided chat so BookMind ships with a defensible reason to exist before going to Google Play, and positions the app as transparent-by-design AI to claim the trust gap Fable left open.

## What Changes

- **BREAKING**: Replace the 6-field `PreferencesPage.vue` form with a guided conversational flow (open-ended opener → loved/disliked book anchor → one LLM-generated dynamic clarifying question).
- Update `POST /recommendations` request shape to accept a turn-by-turn conversation transcript instead of the flat preferences object; old preferences payload no longer accepted.
- Add a new `POST /recommendations/clarify` endpoint that, given the partial transcript, returns the next clarifying question (tailored to what was said so far).
- Restructure the recommendation prompt to reason from the full transcript and produce 3 books with a substantive `reason` that cites the user's own words.
- Surface a one-line "AI transparency" disclosure in the chat (what data is sent, no profile is built) — direct response to the Fable lesson.
- Remove the `userPreferences` typed enums (genre / bookLength / period / complexity / purpose / learningGoal) from `src/types/userPreferences.ts` since the conversation supersedes them. Reading-list, cover lookup, skeleton loaders, and the recommendation card UI are unchanged.

## Capabilities

### New Capabilities
- `conversational-recommendation`: A short, guided multi-turn chat (frontend Vue view + FastAPI endpoints) that elicits the user's current reading desire in natural language, asks at most one LLM-generated follow-up to disambiguate, and returns 3 grounded book recommendations with reasons that cite the user's own phrasing.

### Modified Capabilities
<!-- None — openspec/specs/ is empty; this is the first capability spec for the project. -->

## Impact

- **Frontend (Vue 3 + Capacitor)**: `src/views/PreferencesPage.vue` rewritten as a chat view; `src/services/recommendations/bookRecommendation.ts` updated to call the new endpoints with a transcript payload; `src/types/userPreferences.ts` deleted or reduced to the transcript type; routing entry for `/preferences` repointed (or renamed).
- **Backend (FastAPI)**: `bookmind-server/main.py` `/recommendations` request model changes; new `/recommendations/clarify` route; new prompt builder modules; two LLM calls per session (clarify + recommend) instead of one — cost stays low on `gpt-4o-mini`.
- **Tests / fixtures**: any tests relying on the old preferences payload break and must be updated.
- **No DB migration required** (preferences are not persisted server-side today).
- **Out of scope** (deferred to a follow-up change for the Play Store launch): app icon, splash screen, privacy policy text, store listing assets, signed Android build.