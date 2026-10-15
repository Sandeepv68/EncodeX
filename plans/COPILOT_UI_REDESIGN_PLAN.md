# Copilot UI Redesign — Master Plan (ChatGPT-like conversation UI + Lexical composer)

> **Single source of truth.** `COPILOT_UI_REDESIGN_PLAN_DETAILED.md` and
> `COPILOT_UI_REDESIGN_DETAILED.md` are superseded by this document (and now only
> point here). Do not maintain the older copies — they previously contradicted
> this file (blank phases, `[Rest of plan content follows…]` placeholders and a
> wrong test count: "7 passing / 10 failing").

- **Branch:** `feat/copilot_redesign`
- **Last Updated:** 2026-10-13
- **Owner:** Copilot redesign
- **Related plans:** `AI_CONNECTOR_COPILOT_PLAN.md` (provider layer this UI fronts), `UI_POLISH_PLAN.md`.
- **Status:** Phases 1–6 **implemented** (uncommitted working tree). Phase 6 (quality alignment) is **complete** — the four previously failing blocking gates are green: full unit tier (`npm test`, 293 files / 4234 tests), default ESLint (0 errors), the axe a11y matrix (`test:a11y`, 7/7) and the real-i18n locale matrix (`test:locale-matrix`, 71/71). Two adversarial suites the redesign had regressed (`keyboard-smoke`, `missing-degradation`) were fixed in the product, not the tests. See §5 and §6.

---

## 1. Problem statement (verbatim) and interpretation

> "redesign the copilot page UI to look like that of tools like ChatGPT, for the
> input field and the associated button, use a editor like Lexical to create the
> form and make it look like that of ChatGPT etc"

Interpretation:

- Replace the current **form layout** (goal `TextField`, folder/file pickers,
  operation `Select`, Plan button, inline plan card) with a **thread/conversation
  layout**: scrolling message list, right-aligned user bubbles, left-aligned
  assistant bubbles, and a **composer pinned at the bottom** with a send button.
- The composer's text field **must be a Lexical editor** (rich-text editing
  surface), not an `<input>`/`<textarea>`.
- The "associated button(s)" = the send/submit control plus the attachment
  actions (choose files/folder, AI settings).

This is a **UI/UX redesign**, not a planner/logic change. The bridge contract
(`electronAPI.copilotPlan`, `electronAPI.queueAdd`, `electronAPI.selectFiles`,
`electronAPI.selectFolderFiles`) and the "propose then commit via Batch Queue"
approval model must be preserved.

---

## 2. Verified evidence snapshot (2026-10-13)

All commands below were run from the repo root **after** the redesign edits in
the working tree (not committed). This is the baseline Phase 6 must move to green.

| Gate | Command | Result |
|---|---|---|
| Renderer types | `npx tsc -p tsconfig.renderer.json --noEmit` | **PASS** (exit 0) |
| Copilot unit tests | `npx vitest run src/renderer/__tests__/Copilot.test.tsx` | **FAIL — 15 failed / 2 passed (17)** |
| Default renderer lint | `npx eslint src/renderer/components/copilot src/renderer/pages/Copilot.tsx` | **FAIL — 14 errors, 3 warnings** |
| Repo unused-import rule | `npx eslint -c scripts/eslint.unused.config.mjs …` | **FAIL — 5 errors** |
| Locale key parity | `node scripts/validate-locales.mjs` | **PASS** (55 locales match en-US parity) |
| axe a11y matrix | `npx vitest run --config vitest.a11y.config.ts` | **FAIL — 6 failed / 1 passed**; Copilot reports 4 axe violations |
| Real-i18n locale matrix | `npx vitest run --config vitest.locale-matrix.config.ts` | **At risk (not yet run)** — the new UI calls `t('copilot.goal')` with no default and the key is missing, which the suite's assertion (c) forbids (raw key visible). Also `copilot.bridgeTimeout` / `copilot.planFailed` are missing. |

### 2.1 Exact Copilot axe violations (from `test:a11y`, light+dark × 320/768/1440)

1. `aria-input-field-name` — `<div contenteditable role="textbox" data-lexical-editor>` has **no accessible name**.
2. `aria-prohibited-attr` — `<span aria-label="copilot.send">` (MUI `Tooltip` wrapper around the disabled `IconButton`) uses `aria-label` on a role-less span.
3. `button-name` — the send `IconButton` has **no discernible text** (icon is `aria-hidden`).
4. `heading-order` — Welcome's `Typography variant="h5"` produces an `<h5>` directly under the page `<h1>` (jump h1 → h5).

### 2.2 Exact default-lint failures

```
components/copilot/AssistantMessage.tsx:9   Unused import 'Divider'
components/copilot/ChatComposer.tsx:48      Hardcoded px "1px" (no-hardcoded-px)
components/copilot/ChatInput.tsx:75         Unused variable 'editor' (no-unused)
components/copilot/ChatInput.tsx:121        Hardcoded px "24px"
components/copilot/ChatInput.tsx:122        Hardcoded px "1px"
components/copilot/ChatInput.tsx:127        Hardcoded px "2px"
components/copilot/ChatInput.tsx:144        Inline style prop on ContentEditable (no-inline-styles)
components/copilot/Conversation.tsx:57,69,84  jsx-a11y/aria-role warning (`role` prop on a component)
components/copilot/MessageBubble.tsx:33,33  Hardcoded px "18px" (x2)
components/copilot/MessageBubble.tsx:40     Hardcoded px "1px"
components/copilot/Welcome.tsx:36           Hardcoded px "1px"
pages/Copilot.tsx:20                        Unused import 'formatError'
pages/Copilot.tsx:27                        Unused variable 'OPERATION_CHOICES'
pages/Copilot.tsx:35                        Unused variable 'setOperation'
```

> Note: `lint:strings` passed on the new files, so no hardcoded **user-facing**
> strings leaked; the failures are pixel/inline-style and unused-symbol rules.

---

## 3. Goals / non-goals

### Goals
1. ChatGPT-like **conversation** UI on `/copilot` (message list + composer).
2. **Lexical** rich-text composer for the input field with a working send button.
3. Preserve the existing **bridge contract** and **Batch Queue approval** flow.
4. Keep all user-visible text in **i18n** (all 56 locales), preserving `en-US` key parity.
5. Pass every **blocking CI gate** the repo enforces (unit, lint variants, a11y matrix, locale matrix, typecheck).

### Non-goals (this plan)
- Changing the planner, the IPC contract, or the AI provider layer (see `AI_CONNECTOR_COPILOT_PLAN.md`).
- Persisting conversation history across app restarts (explicitly out of scope; state is in-component).
- Streaming tokens / real-time assistant typing (the assistant message is added optimistically, then resolved — see §7).

---

## 4. Current implementation inventory (Phases 1–5, uncommitted)

`git status` (working tree):

```
modified:   package.json           (+5 Lexical deps)
modified:   package-lock.json
modified:   src/renderer/pages/Copilot.tsx   (455 lines changed)
untracked:  src/renderer/components/copilot/ (6 new files)
untracked:  plans/COPILOT_UI_REDESIGN_*.md   (these plans)
```

### 4.1 New files

| File | LOC | Responsibility | Key observations |
|---|---|---|---|
| `src/renderer/components/copilot/Conversation.tsx` | 93 | Scroll container; maps `ConversationMessage[]`; renders `Welcome` when empty, `MessageBubble` per message, spinner when `isThinking`. | `role` prop on `<MessageBubble>` trips `jsx-a11y/aria-role`. Auto-scroll effect depends only on `[messages, isThinking]`. |
| `src/renderer/components/copilot/MessageBubble.tsx` | 49 | Chat bubble (user = primary right, assistant = paper left). | Wraps `children` in `Typography` → block children (`List`, `Box`, `Button`) nest inside a `<p>` (invalid DOM). Hardcoded px. |
| `src/renderer/components/copilot/AssistantMessage.tsx` | 159 | Renders a `CopilotPlan` (routed-as chip, actions, results, skips, rationale, "Add to queue"). | `Divider` imported but unused. `action: any` / `result: any` / `skip: any` lose the shared types. |
| `src/renderer/components/copilot/Welcome.tsx` | 50 | Empty-state hero (robot icon, title, blurb). | Uses `t('copilot.goal')` — key **does not exist** → raw key. `variant="h5"` breaks heading order. |
| `src/renderer/components/copilot/ChatComposer.tsx` | 100 | Composer shell: attachment chips, `ChatInput`, choose files/folder, AI settings, Plan button, location note. | Plan button `disabled={!canSubmit || !hasInputs}`; hardcoded px border. |
| `src/renderer/components/copilot/ChatInput.tsx` | 193 | Lexical composer (RichText + History + AutoFocus + Enter + sync plugins) and icon send button. | See defect ledger D2–D5, D8, D11, D12. |

### 4.2 Modified `src/renderer/pages/Copilot.tsx`

- Now a **conversation controller**: holds `messages`, `input`, `inputs`, `operation` (kept but unused), `busy`, `isThinking`, `globalError`.
- `buildPlan()` appends an optimistic user message + a placeholder assistant message, then resolves the assistant message with the plan / error / timeout.
- `addToQueue(plan)` iterates `plan.actions` → `queueAdd`, shows a success toast, navigates to `/batch` only when **all** actions enqueue.
- Renders `PageContainer` → `Conversation` + `ChatComposer`.

### 4.3 `package.json` additions

```
lexical            ^0.28.0
@lexical/react     ^0.28.0
@lexical/rich-text ^0.28.0   (declared, not directly imported)
@lexical/history   ^0.28.0   (declared; only used transitively by @lexical/react's HistoryPlugin)
@lexical/utils     ^0.28.0   (declared, not directly imported)
```

---

## 5. Regression matrix (old `HEAD` page → current working tree)

| Old behaviour (at `HEAD`) | New status | Impact |
|---|---|---|
| Goal `TextField` | Replaced by Lexical composer | Expected |
| `copilot-subtitle` (`copilot.subtitle`) | **Dropped** | Subtitle key now unused |
| Operation `Select` (`copilot.operationLabel`, `copilot.op.*`) | **Dropped** | Breaks 2 tests; loss of forced-operation feature |
| `query` field for `search_transcript` | **Dropped** | Breaks 1 test; `query` no longer sendable |
| `targetLanguage` field for `translate` | **Dropped** | Breaks 1 test; `targetLanguage` no longer sendable |
| Selected-count `Chip` (`copilot-selected-count`) | **Dropped** (attachments now shown as chips in composer) | Test id gone |
| Inline `copilot-error` `<Alert>` | Partially kept — now only for enqueue/global errors | Guard errors lost |
| Inline `copilot-notice` `<Alert>` (`folderEmpty`/`filesEmpty`) | Replaced by toast | Test id gone; breaks 2 tests |
| `errorNoGoal` guard message | **Dropped** — `buildPlan` silently returns | Breaks 1 test |
| `errorNoInputs` guard message | **Dropped** — `buildPlan` silently returns | Breaks 1 test |
| `errorFallback` (malformed payload) | Replaced by `copilot.planFailed` (key missing) | Breaks 1 test + locale matrix |
| `partiallyAdded` on partial enqueue | **Dropped** — only shows success toast | Breaks 1 test |
| `formatError(err)` for thrown bridge errors | Replaced by raw `e.message` | Loses error mapping; `formatError` import now unused |
| Page icon `pageIcons['/copilot']` | **Regressed** to `icon="robot"` (literal string) | Renders the text "robot", not the robot icon |
| Mount inert (no bridge calls) | **Preserved** | PASS |

---

## 6. Defect ledger (Phase 6 must fix all)

Severity: **S1** = blocking gate red / functional break; **S2** = correctness/robustness; **S3** = polish.

| ID | Sev | Defect | Location | Fix |
|---|---|---|---|---|
| D1 | S1 | `t('copilot.goal')` with no key → raw key visible; fails locale-matrix assertion (c) | `Welcome.tsx:46` | Add key OR use existing `copilot.goalLabel`/new `copilot.welcomeBlurb` |
| D2 | S1 | `EnterKeyPlugin` registers a **custom** `INSERT_LINE_BREAK_COMMAND` that nothing ever dispatches → **Enter does not submit** | `ChatInput.tsx:37,43` | Register on Lexical's real `KEY_ENTER_COMMAND` (or `INSERT_LINE_BREAK_COMMAND` imported from `lexical`), returning `true` for plain Enter, `false` for Shift+Enter. Add a test. |
| D3 | S1 | Missing i18n keys render raw keys (also breaks locale matrix): `copilot.placeholder`, `copilot.send`, `copilot.bridgeTimeout`, `copilot.planFailed` | `ChatInput.tsx:164,175`; `Copilot.tsx:121,140` | Add keys to `en-US.json` and run `npm run sync:locales` so all locales stay parity-clean |
| D4 | S1 | a11y: contenteditable has no accessible name | `ChatInput.tsx:143` | `aria-label={t('copilot.inputAria', …)}` (and/or `aria-labelledby`) on `ContentEditable` |
| D5 | S1 | a11y: send `IconButton` has no name; `Tooltip` puts `aria-label` on a bare `<span>` | `ChatInput.tsx:175` | Put `aria-label={t('copilot.send')}` on the `IconButton`; drop the Tooltip-created span-label (use `slotProps`, or remove Tooltip, or add a visually-hidden label) |
| D6 | S1 | a11y: heading order h1 → h5 | `Welcome.tsx:42` | Use `variant="h2"`/`component="h2"` (or non-heading `subtitle1`) |
| D7 | S1 | Default lint: hardcoded px (`1px`,`2px`,`18px`,`24px`) and inline `style` on contenteditable | `ChatComposer.tsx:48`; `ChatInput.tsx:121,122,127,144`; `MessageBubble.tsx:33,40`; `Welcome.tsx:36` | Use `theme.typography.pxToRem(...)`; move ContentEditable styles to a `styled()` component under `styles/` |
| D8 | S1 | Unused symbols | `AssistantMessage.tsx:9`; `ChatInput.tsx:75`; `Copilot.tsx:20,27,35` | Remove `Divider`, the unused `editor`, `formatError`, `OPERATION_CHOICES`, `setOperation` |
| D9 | S2 | `MessageBubble` nests block content in `Typography` (`<p>`) | `MessageBubble.tsx:43` | Render children directly (or `component="div"`); keep text formatting via a child `Typography` |
| D10 | S2 | `disabled` only applied via `initialConfig.editable` at mount — toggling `disabled` prop later is ignored | `ChatInput.tsx:105-110` | Add a plugin that calls `editor.setEditable(!disabled)` on change |
| D11 | S2 | Two submit paths with **different** guards: composer Plan button requires inputs, Lexical send button does not. Submitting with no inputs is a silent no-op | `ChatComposer.tsx:88`; `ChatInput.tsx:180`; `Copilot.tsx:77` | Unify: single submit handler that surfaces the guard error (restore D-of §5 messages) and one disabled rule |
| D12 | S2 | Guard errors silently dropped (empty goal / no inputs) | `Copilot.tsx:76-78` | Restore `copilot.errorNoGoal` / `copilot.errorNoInputs` inline (or in-thread) |
| D13 | S2 | Partial enqueue no longer reports `copilot.partiallyAdded` | `Copilot.tsx:160-183` | Distinguish partial vs total failure (restore old logic) |
| D14 | S2 | Malformed/ thrown plan errors lose `formatError` mapping and use missing keys | `Copilot.tsx:136-153` | Use `formatError(e).message`; add `copilot.planFailed` |
| D15 | S2 | `pageIcons` regression: `icon="robot"` renders literal text | `Copilot.tsx:190` | `icon={pageIcons['/copilot']}` (restore import) |
| D16 | S2 | `role` prop name on `<MessageBubble>` misread by `jsx-a11y/aria-role` | `Conversation.tsx:57,69,84`; `MessageBubble.tsx:9` | Rename prop to `variant`/`speaker` to avoid the ARIA-role false positive |
| D17 | S3 | `Notice` (`message.notice`) is never set — dead field | `Conversation.tsx:20`; `Copilot.tsx` | Either wire notices into the thread or drop the field |
| D18 | S3 | Typed plan fields widened to `any` | `AssistantMessage.tsx:69,98,113` | Use `CopilotAction` / `CopilotResult` / `AgentSkip` |
| D19 | S3 | Auto-scroll doesn't follow late content growth in a resolved assistant message | `Conversation.tsx:35-39` | Depend on `messages` content/`plan` or use a `ResizeObserver`/`scrollIntoView` on last item |
| D20 | S3 | `@lexical/rich-text` and `@lexical/utils` declared but unused | `package.json` | Remove the two unused direct deps (keep `@lexical/history` if `@lexical/react` peers require it) |
| D21 | S3 | `package.json` lost trailing newline | `package.json` | Restore newline |

---

## 7. Feature-parity decision record (must be resolved before Phase 6 tests)

The redesign dropped the operation/query/targetLanguage controls, which three
existing unit tests assert. Decide explicitly:

| Option | Effect | Recommendation |
|---|---|---|
| **A. Keep advanced controls** behind a discreet popover/chip row in the composer | Preserves forced operation, transcript search, translation; 3 tests keep passing with minor selector updates | **Recommended** — smallest functional regression, matches "etc" in the request |
| **B. Drop them; auto-routing only** | Simpler ChatGPT look; delete/adjust the 3 tests; lose ability to force `search_transcript`/`translate` | Acceptable only if the operations are unreachable by natural language |
| **C. Hybrid** — auto by default, a "More" menu to override | Best UX, most work | Good if time allows |

**Decision: A — keep the advanced controls in a discreet popover.** Implemented as
a MUI `Popover` opened from an "Advanced" button in the composer
(`copilot-advanced`), holding the operation `select` (`copilot-operation`), the
transcript-search phrase (`copilot-query`, shown only for `search_transcript`)
and the translation target (`copilot-target-language`, shown only for
`translate`). `auto` is the default, so the ChatGPT-style surface is unchanged
for the common path while the three parity tests keep their scenarios.

---

## 8. Phase 6 work breakdown

### Phase 6a — i18n (D1, D3, D14)
- [x] Add to `en-US.json` under `copilot`: `goal`, `welcome`, `placeholder`, `send`, `inputAria`, `bridgeTimeout`, `planFailed` (plus `advanced`/`advancedTitle` and the restored `errorNoGoal`/`errorNoInputs`/`errorEnqueue`/`partiallyAdded`/`folderEmpty`/`filesEmpty`).
- [x] Run `npm run sync:locales` (55/55 updated), then `npm run validate:locales` (parity passed).
- [x] Confirm no component calls `t()` without a key that exists (search `t('copilot.`).
- [x] Verify locale-matrix gate: `npm run test:locale-matrix` (71/71).

### Phase 6b — lint/quality (D7, D8, D20, D21)
- [x] Replace every hardcoded px with `theme.typography.pxToRem(...)` (`lint:px` 0 errors).
- [x] Move the Lexical `ContentEditable` inline styles into `styled()` components in `src/renderer/styles/copilot/`.
- [x] Remove unused imports/vars (`Divider`, `editor`, `formatError`, `OPERATION_CHOICES`, `setOperation`).
- [ ] Remove unused direct Lexical deps — **deferred**: `@lexical/rich-text`, `@lexical/history`, `@lexical/utils` remain declared (only `lexical` + `@lexical/react` are imported); harmless transitively, so removing them is optional cleanup.
- [x] Rename `MessageBubble` `role` prop → `speaker` (D16).
- [x] Run all lint variants: `npm run lint`, `lint:unused`, `lint:strings` (0 errors; only pre-existing warnings in unrelated files).

### Phase 6c — Lexical correctness (D2, D10, D11)
- [x] Fix Enter-to-submit via the real `KEY_ENTER_COMMAND`; Shift+Enter dispatches `INSERT_LINE_BREAK_COMMAND`.
- [x] Add an `EditablePlugin` that syncs `disabled` → `editor.setEditable`.
- [x] Simplify `ValueSyncPlugin` (remove the dead `initializedRef` branch; clearing is driven by the controlled `value`).
- [x] Verify no infinite update loop between `onChange` → page `setInput` → prop `value`.

### Phase 6d — DOM/semantics & a11y (D4, D5, D6, D9, D19)
- [x] Give the contenteditable an accessible name (`aria-label` = `copilot.inputAria`).
- [x] Give the send button `aria-label` + `title`; drop the `Tooltip` (and its prohibited `aria-label`).
- [x] Fix heading order in `Welcome` (h2 now uses the new `copilot.welcome` string, so the empty state no longer duplicates the page `<h1>` title).
- [x] Stop nesting block content inside `Typography` in `MessageBubble` (children-based bubble).
- [x] Add `aria-live="polite"` to the conversation region; scroll the latest message into view.
- [x] Verify `npm run test:a11y` (7/7) is green.
- [x] Add `tabIndex={0}` to the contenteditable (jsdom does not treat `contenteditable` as focusable; the real browser already tabbables it — this makes the `keyboard-smoke` tab walk — and AT behaviour — deterministic).

### Phase 6e — functional parity (D11–D15, §7)
- [x] Implement the chosen option from §7 (Option A, popover).
- [x] Restore guard errors (`errorNoGoal`/`errorNoInputs`) and partial-enqueue reporting.
- [x] Restore `formatError` for thrown bridge errors.
- [x] Restore `pageIcons['/copilot']`.

### Phase 6f — tests
- [x] Rewrite `src/renderer/__tests__/Copilot.test.tsx` for the conversation UI:
  - [x] Assert inert mount (`copilot-plan`/composer present, no bridge calls).
  - [x] Drive the **Lexical** editor via native `editor.focus()` + `fireEvent.input(..., { data })` on `[data-lexical-editor]` (`fireEvent.change` is a no-op for Lexical; `AutoFocusPlugin` was removed so the test owns focus).
  - [x] Assert Enter submits and Shift+Enter does not.
  - [x] Assert attachment chips + remove (chip delete icon → `onRemoveInput` → smaller `inputs`).
  - [x] Assert the assistant plan renders (`copilot-plan-summary`, action/skip/result test ids).
  - [x] Assert `copilot-add-to-queue` → `queueAdd` per action.
  - [x] Assert guard errors, malformed payload, rejected request, partial vs total enqueue.
  - [x] Keep the "links to Settings without a bridge call" test.
- [x] Add component tests for `ChatInput` (Lexical sync, clear-on-submit, disabled, Enter/Shift+Enter) and `Conversation` (empty/welcome, thinking, plan, error/notice, skipped) — `copilot-components.test.tsx`, 10 tests.
- [x] Re-run `npm test` (full unit tier) — 293 files / 4234 tests, zero regressions.

### Phase 6g — full verification (see §11)
- [x] `typecheck:renderer`, `lint` (+all variants), `test`, `test:a11y`, `test:locale-matrix` — all green.
- [ ] Manual smoke: mount `/copilot`, attach files/folder, type, Enter, view plan, add to queue, navigate to `/batch` (pending human).

---

## 9. i18n key additions (en-US, then `sync:locales`)

| Key | Proposed en-US value |
|---|---|
| `copilot.goal` | `Describe what you want EncodeX to do, then attach files or a folder.` |
| `copilot.placeholder` | `Describe what you want EncodeX to do...` |
| `copilot.send` | `Send` |
| `copilot.inputAria` | `Message Copilot` |
| `copilot.bridgeTimeout` | `EncodeX did not respond in time. Try again.` |
| `copilot.planFailed` | `Copilot could not build a plan for that goal.` |

Existing keys reused as-is: `title`, `subtitle`, `goalLabel`, `chooseFolder`,
`chooseFiles`, `selectedCount`, `selectedNone`, `operationLabel`, `op.*`,
`queryLabel`, `targetLanguageLabel`, `plan`, `planning`, `folderEmpty`,
`filesEmpty`, `errorNoGoal`, `errorNoInputs`, `errorFallback`, `errorEnqueue`,
`actionsTitle`, `routedAs`, `noActions`, `savings`, `output`, `resultsTitle`,
`skipsTitle`, `rationaleTitle`, `addToQueue`, `applyNote`, `addedToQueue`,
`partiallyAdded`, `ai.*`.

---

## 10. Test matrix (target state)

| Tier | Gate / command | Suite | Must be |
|---|---|---|---|
| Types | `typecheck:renderer` | tsc | PASS |
| Unit | `npm test` | `Copilot.test.tsx` (rewritten) + new `ChatInput`/`Conversation` specs | PASS |
| Lint | `npm run lint` | default ESLint | PASS |
| Lint | `lint:unused`, `lint:strings`, `lint:px`, `lint:inline-styles` | custom rules | PASS |
| a11y | `npm run test:a11y` | `axe-all-pages.test.tsx` (13 routes × 2 themes × 3 widths) | PASS |
| i18n | `npm run test:locale-matrix` | real-i18next, 56 locales × 12 pages | PASS |
| i18n | `npm run validate:locales` | key parity + integrity | PASS |
| E2E | `npm run test:e2e` (if Copilot is covered) | Playwright/Electron | PASS (or N/A) |

---

## 11. Verification commands (Windows / PowerShell)

```powershell
# Types
npx tsc -p tsconfig.renderer.json --noEmit

# Unit (targeted, then full)
npx vitest run src/renderer/__tests__/Copilot.test.tsx
npm test

# Lint variants
npm run lint
npm run lint:unused
npm run lint:strings
npm run lint:px
npm run lint:inline-styles

# a11y matrix (blocking CI gate)
npm run test:a11y

# i18n
npm run validate:locales
npm run test:locale-matrix
```

---

## 12. Definition of done (acceptance criteria)

1. `/copilot` renders a ChatGPT-style thread: empty-state welcome → user bubble →
   assistant bubble/plan, with a bottom-pinned Lexical composer.
2. **Enter** submits; **Shift+Enter** inserts a newline; the send button is
   disabled when the composer is empty; attaching files/folder works; attachments
   are removable.
3. The bridge contract is unchanged; no bridge call happens on mount; committing a
   plan uses `queueAdd` and navigates to `/batch` only when every action enqueues.
4. All guard/edge cases from the old page are preserved (empty goal, no inputs,
   malformed payload, rejected request, partial/total enqueue) **or** an explicit
   §7 decision documents their removal.
5. **All gates in §10 are green**, including the blocking axe a11y matrix and the
   real-i18n locale matrix.
6. `en-US.json` and all 55 other locales pass `validate:locales` parity.

---

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Lexical + jsdom is awkward to test (`fireEvent.change` can't set contenteditable) | Use `userEvent.type` into `[data-lexical-editor]`; assert via `editor.getEditorState().read($getRoot().getTextContent())` where needed |
| Controlled `value` ↔ Lexical `onChange` feedback loop | Centralize sync in one plugin; guard with a "last applied" ref; add a test that types then submits twice |
| Locale matrix is slow (≈56×12 mounts) and runs in its own CI job | Run it once locally before pushing; rely on `sync:locales` to keep parity |
| RTL: composer/chips bubble direction | Reuse existing `stylis-plugin-rtl` + `DirectionProvider`; add one RTL smoke assertion |
| Dropping advanced controls silently regresses features | Resolve §7 before touching tests |
| Bundle growth from Lexical | Measure with the Codecov bundle-analysis plugin already wired in CI |

---

## 14. File-by-file change map (Phase 6)

| File | Change |
|---|---|
| `src/renderer/pages/Copilot.tsx` | Remove unused symbols; restore guard errors, `formatError`, `partiallyAdded`; fix icon; unify submit; wire notices or drop field; implement §7 |
| `src/renderer/components/copilot/ChatInput.tsx` | Real Enter command; editable sync; a11y name on editor + send button; styled() over inline styles; de-px |
| `src/renderer/components/copilot/ChatComposer.tsx` | Unify submit/disable; de-px border |
| `src/renderer/components/copilot/MessageBubble.tsx` | Rename `role`→`speaker`; render children without `<p>` nesting; de-px |
| `src/renderer/components/copilot/Conversation.tsx` | Rename prop usage; `aria-live`; robust auto-scroll; wire/drop `notice` |
| `src/renderer/components/copilot/AssistantMessage.tsx` | Remove unused `Divider`; replace `any` with shared types |
| `src/renderer/components/copilot/Welcome.tsx` | Fix heading level; fix blurb key; de-px |
| `src/renderer/i18n/locales/*.json` | Add keys (via `sync:locales`) |
| `src/renderer/__tests__/Copilot.test.tsx` | Rewrite for conversation + Lexical |
| `package.json` | Drop unused Lexical deps; restore newline |
