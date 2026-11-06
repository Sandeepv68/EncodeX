# Copilot Page Responsive Hardening Plan

> **Status:** Complete
> **Scope:** `/copilot` route + all child components. No app-shell/window-size changes.
> **Decisions locked:** icon-only actions + tooltips under `sm`; saved-chats drawer becomes an overlay under `md`; Copilot-only scope.
> **Verification:** Unit, lint, typecheck, locale, a11y, and Copilot E2E gates pass; full E2E pass after re-running one flaky CLI usage test.

- **Branch:** `feat/copilot-responsive`
- **Last Updated:** 2026-11-06
- **Related plans:** `COPILOT_UI_REDESIGN_PLAN.md`, `UI_POLISH_PLAN.md`.
- **Target widths:** 320px (`xs`), 768px (`sm`), 960px (production window minimum, `md`), 1280/1440px (`lg`).

---

## 1. Objective

Make `/copilot` usable and visually stable from **320px to 1440px+** (and at the production minimum window width of **960px**) with:

- No horizontal overflow.
- A composer that always fits and keeps the input, Plan button, and actions reachable.
- Readable conversation bubbles and plan rows with long file paths.
- A saved-chats panel that never squeezes or overflows the conversation on small screens.
- No regression at desktop widths, in RTL, in light/dark, or in existing tests/a11y.

## 2. Non-goals

- Changing the planner, IPC contract, or Batch Queue flow.
- Changing `WINDOW_SIZE.MIN_WIDTH` or the Electron shell.
- Making the Lexical editor multi-line/wrapping.
- Redesigning the visual language. This is fluid sizing, wrapping, collapsing, and overlay behavior.

## 3. Breakpoints and target widths

MUI defaults apply:

| Token | Range | Test width |
|---|---|---|
| `xs` | 0–599px | 320px |
| `sm` | 600–899px | 768px |
| `md` | 900–1199px | 960px (production min) |
| `lg` | 1200px+ | 1280/1440px |

Use `theme.breakpoints` inside `styled()` components. Prefer **CSS-only responsiveness** so existing unit tests and jsdom are unaffected.

---

## 4. Current architecture

```
PageContainer (paper=false, fill)
└─ CopilotPage                    flex row, negative margins, overflow hidden
   ├─ Aurora                absolute decorative layer
   ├─ SavedChatsDrawer            flex sibling, fixed 320px when open
   └─ CopilotConversationColumn
      ├─ alerts
      ├─ Conversation             virtualized transcript
      │  ├─ Welcome
      │  ├─ MessageBubble
      │  │  ├─ user text / attachment count
      │  │  └─ AssistantMessage → PlanTargetSummary, McpAppView
      │  └─ thinking row
      └─ ChatComposer
         ├─ AttachmentRow / AttachmentCard
         ├─ ChatInput             Lexical one-line editor
         └─ ActionsRow            file/folder/advanced/save/saved/AI buttons
```

Shell context relevant to responsiveness:

- `AppRoot` is `100vh`; `TitleBar` is 36px; `Footer` is 52px.
- `MainContent` pads by `spacing(2)` / `spacing(3)`; Copilot cancels it with negative margins.
- `MainContent` has `overflow: auto`; overflow inside Copilot can therefore create a scrollbar inside `main`.

---

## 5. Audit findings

| ID | Priority | File(s) | Issue | Direction |
|---|---|---|---|---|
| R1 | P0 | `styles/copilot/ChatInput.styles.ts:23`; `ChatComposer.styles.ts:14` | `ComposerShell` has fixed `width: 750px`, while `ComposerBar` is `maxWidth: 80%`. At 320px the shell is ~750px wide and overflows. | Make both fluid: `width: 100%`, `maxWidth: 750px`, centered. |
| R2 | P0 | `styles/copilot/SavedChatsDrawer.styles.ts:7,16,28` | Drawer is a flex sibling with a fixed 320px shell/panel. On small screens it pushes/overflows the conversation despite the "overlay" comment. | Overlay + backdrop under `md`; push behavior preserved at `md+`. |
| R3 | P0 | `components/copilot/ChatComposer.tsx:233-311`; `ChatComposer.styles.ts:66-87` | Six labeled buttons plus the AI status pill wrap into many rows; tap targets are small. | Icon-only 44px buttons with `aria-label`/tooltip under `sm`; hide status caption under `md`. |
| R4 | P1 | `ChatInput.styles.ts:52,61,110,146` | Editor row and Plan button are fixed at 64px; reset button is 64×64. On narrow widths the editable field is squeezed. | 56px row under `sm`, 64px at `sm+`; reset 40px under `sm`; Plan becomes icon-only under `sm`. |
| R5 | P1 | `ChatComposer.styles.ts:41-54` | Attachment stack has no max height; many attachments can consume the viewport. | Cap at ~32vh (`xs`) / 40vh (`sm+`) with internal scroll. |
| R6 | P1 | `ChatComposer.styles.ts:142` | Advanced popover `minWidth: 280px` can overflow 320px with margins. | `width: min(320px, calc(100vw - 24px))`; full-width fields. |
| R7 | P1 | `ChatComposer.styles.ts:267-279` | File-list popover min/max widths can overflow or clip on short screens. | Clamp to viewport, `maxHeight: 40vh`, popper `preventOverflow`/flip. |
| R8 | P1 | `MessageBubble.styles.ts:38`; `AssistantMessage.tsx:88-109`; `AssistantMessage.styles.ts:71-88` | 85% bubbles and long absolute paths can overflow; list rows lack `minWidth: 0`/wrap rules. | 92% bubbles under `sm`; wrap anywhere; stack secondary text. |
| R9 | P2 | `styles/Copilot.styles.ts:62-66` | Alert wrapper adds inline padding on top of the column padding, over-narrowing alerts. | Remove the extra inset; rely on column padding. |
| R10 | P2 | `Welcome.styles.ts:14` | Fixed `paddingBlock: 4` is heavy on short screens. | Responsive/clamped vertical padding. |
| R11 | P2 | `components/copilot/Aurora.tsx:64-69` | Canvas resolution uses `window.innerWidth/Height`, not its layer; 90 sparkles + 90px blur is heavy on small devices. | Measure the layer, reduce sparkles/blur under `sm`, keep reduced-motion path. |
| R12 | P2 | `ChatComposer.tsx` buttons; `ChatInput.styles.ts:110` | Small buttons/icon buttons fall below a 44px touch target. | Enforce 44px minimum under `sm`. |
| R13 | P2 | New changes | RTL/logical-property regressions. | Use `insetInline`, `marginInline`, `paddingInline`; add one RTL smoke. |
| R14 | P3 | `Copilot.styles.ts` | No safe-area inset for the bottom composer in future/web contexts. | Optional `env(safe-area-inset-bottom)` padding. |

**Concrete overflow example:** at 320px, `ComposerBar` allows ~256px of content (`80%`), but `ComposerShell` is fixed at `750px`; the flex column does not shrink width, so roughly 494px overflows.

---

## 6. Implementation phases

### Phase 0 — Baseline capture
- Run the app at 960/1280/1440 and Playwright at 320/768/1440.
- Record `document.documentElement.scrollWidth`, `main.scrollWidth/clientWidth`, and bounding boxes of the composer, Plan button, action row, drawer.
- Run current gates to confirm the starting point:
  - `npm run typecheck:renderer`
  - `npx vitest run src/renderer/__tests__/Copilot.test.tsx`
  - `npm run test:a11y`
- Optional: capture before screenshots for the three widths.

### Phase 1 — Shell and containers
Files: `src/renderer/styles/Copilot.styles.ts`

- `CopilotPage`: add `width: '100%'`, `minWidth: 0`, `boxSizing: 'border-box'`; keep `overflow: 'hidden'`.
- Verify the negative margins still exactly cancel `MainContent` padding at `xs` and `sm+`.
- `CopilotConversationColumn`: add `width: '100%'`, `minWidth: 0`; keep responsive `2`/`3` padding.
- Remove the duplicate inline padding from `CopilotAlertWrapper` (R9).

Acceptance: empty Copilot has no horizontal scrollbar at 320px.

### Phase 2 — Composer and input
Files: `ChatComposer.styles.ts`, `ChatInput.styles.ts`, `ChatComposer.tsx`, `ChatInput.tsx`

- `ComposerBar`: replace `maxWidth: '80%'` with `width: '100%'`, `maxWidth: pxToRem(750)`, `marginInline: 'auto'`.
- `ComposerShell`: `width: '100%'`, `maxWidth: pxToRem(750)`, `minWidth: 0`. Keep the pill radius; use a smaller radius under `sm`.
- `EditorArea` / contenteditable / placeholder: 56px under `sm`, 64px at `sm+`; keep one-line behavior.
- `ResetIconButton`: 40×40 under `sm`, 64×64 at `sm+`.
- `ComposerPlanButton`: 56/64px height; reduce inline padding under `sm`; wrap the visible label in a `<ComposerPlanLabel>` and hide that span under `sm` (text stays in the DOM so current tests keep passing). Add `aria-label` based on `busy`.
- `AttachmentRow`: `width: '100%'`, `maxHeight: 32vh` under `sm` / `40vh` at `sm+`, `overflowY: 'auto'`, `overscrollBehavior: 'contain'`.
- `AttachmentCard`: `width: '100%'` under `sm`, `90%` at `sm+`; max width inherited from the row.
- `ActionsRow`, `LeftActions`, `RightActions`: `minWidth: 0`, responsive gaps, keep `flexWrap: 'wrap'`.
- Action buttons: add `aria-label` (reuse existing keys) and wrap labels in `ComposerActionLabel`, hidden under `sm`. Add tooltips on the icon-only state. Enforce `minHeight: 44px` / `minWidth: 44px` on the button root under `sm`.
- `AiConnectionStatus` / `StatusPill`: hide the caption under `md` (badge only); keep the hover expansion at `md+`. Make the AI configure button icon-only under `sm`.
- `AdvancedPanel`: width clamp, `maxHeight: 70vh`, internal scroll, fields `fullWidth`.
- `AttachmentFileList` / popper: clamp width to `min(360px, calc(100vw - 24px))`, `maxHeight: 40vh`; add `preventOverflow` with padding and rely on flip placement.

Acceptance: at 320px the composer, Plan button, and every action are visible/reachable with no horizontal overflow; long attachment rows scroll inside the composer.

### Phase 3 — Conversation content
Files: `Conversation.styles.ts`, `MessageBubble.styles.ts`, `AssistantMessage.styles.ts`, `Welcome.styles.ts`

- `ConversationScroll`: responsive padding, `overscrollBehavior: 'contain'`, `scrollbarGutter: 'stable'`.
- `Bubble`: `maxWidth: '92%'` under `sm`, `85%` at `sm+`; reduce padding slightly under `sm`.
- `AssistantBody`: `minWidth: 0`, `overflowWrap: 'anywhere'`.
- `PlanListItem`: `alignItems: 'flex-start'`; inner `ListItemText` gets `minWidth: 0`, `overflowWrap: 'anywhere'`, `wordBreak: 'break-word'`.
- Wrap savings/output/target summary in a responsive `flexWrap` container; remove the fixed `marginLeft` under `sm` so secondary lines stack.
- `RoutedChip`: `maxWidth: '100%'`; allow its label to wrap.
- Add-to-queue button: `width: '100%'` under `sm`, auto at `sm+`.
- `ActionListItemIcon`: reduce min width under `sm` (36px vs 44px).
- `WelcomeRoot`: clamp vertical padding; subtitle `maxWidth: '100%'`.
- `McpViewBlock`: contain wide views with `overflowX: 'auto'` and `maxWidth: '100%'`.

Acceptance: long Windows paths and long operation labels never overflow a bubble; every plan row remains readable.

### Phase 4 — Saved chats drawer overlay
Files: `SavedChatsDrawer.styles.ts`, `SavedChatsDrawer.tsx`, `Copilot.tsx`

- Add a `DrawerBackdrop` styled box: absolute inset, dim background, below panel, hidden at `md+`, fades with open state.
- Under `md`: `DrawerShell` becomes `position: absolute`, `insetBlock: 0`, `insetInlineStart: 0`, `width: min(320px, 88vw)`, high z-index; `width: 0` when closed.
- At `md+`: keep the current flex-sibling push behavior with the 320px panel.
- `DrawerPanel`: `width: '100%'`, `maxWidth: 320px`.
- Render the backdrop only when `open`; clicking it calls `onClose`.
- Focus: move focus to the close button on open; restore to the trigger on close; close on `Escape`.
- If strict modal semantics are required under `md`, add `inert` to the conversation column while open in a follow-up (not required for the initial pass; document the tradeoff).

Acceptance: at 320px the drawer fits inside the viewport, the conversation is not shifted horizontally, and closing restores the transcript.

### Phase 5 — Aurora and performance
Files: `Aurora.styles.ts`, `Aurora.tsx`

- Measure the canvas layer with `ResizeObserver` / `getBoundingClientRect` instead of `window.innerWidth/Height`.
- Reduce sparkles (e.g. 90 → ~45) and blur (90px → ~60px) under `sm`; keep the existing `prefers-reduced-motion` path.
- Keep `compact` height at 30% and consider 35% under `sm` so the band stays visible.
- Verify no RAF/listener leaks on resize/unmount (existing tests already check listener leaks).

### Phase 6 — i18n, a11y, and RTL
- Reuse existing keys for icon-only `aria-label`s: `copilot.chooseFiles`, `chooseFolder`, `advanced`, `saveChat`, `savedChats`, `ai.configure`, `plan`, `planning`, `resetConversation`. **No new strings expected.**
- Ensure all icon-only controls have accessible names and visible focus.
- Keep the heading order and `aria-live` behavior unchanged.
- Backdrop is `aria-hidden`; drawer close button remains labelled.
- Use logical properties for every new inset/margin.
- Add one RTL smoke assertion (composer and drawer open correctly with `dir="rtl"`).

### Phase 7 — Tests and verification
**Unit**
- Existing `Copilot.test.tsx`, `copilot-components.test.tsx`, `copilot-aurora.test.tsx` must pass unchanged because the changes are CSS-only.
- Add `src/renderer/__tests__/copilot-responsive.test.tsx`:
  - Icon-only action buttons still expose `aria-label` and their label text remains in the DOM.
  - Plan button exposes an accessible name when the visual label is hidden.
  - Drawer backdrop exists only when open and closes on click.
  - RTL render smoke.

**Browser E2E (new `e2e/specs/copilot-responsive.spec.ts`)**
- Widths: 320, 768, 1440; light + dark.
- Assert no horizontal overflow:
  - `document.documentElement.scrollWidth <= window.innerWidth`
  - `main.scrollWidth <= main.clientWidth`
- Assert composer, Plan button, and action buttons are within the viewport (`getBoundingClientRect` bounds).
- Open Advanced, choose a folder (mock), build a plan, assert the plan summary is visible and the transcript still scrolls.
- Open an attachment file list and assert it stays within the viewport.
- Open Saved chats:
  - At 320: panel within viewport, backdrop visible, no conversation shift.
  - At 1440: current desktop behavior preserved.
- Keep existing `copilot.spec.ts`, `copilot-saved-chats.spec.ts`, `copilot-mcp-views.spec.ts` green.

**Gates**

```powershell
npm run typecheck:renderer
npm run lint
npm run lint:px
npm run lint:inline-styles
npm run lint:unused
npm run lint:strings
npx vitest run src/renderer/__tests__/Copilot.test.tsx src/renderer/__tests__/copilot-components.test.tsx
npm test
npm run test:a11y
npm run validate:locales
npm run test:e2e
```

---

## 7. Responsive behavior matrix

| Component | xs (320) | sm (768) | md (960) | lg (1280+) |
|---|---|---|---|---|
| Composer width | 100% | 100%, max 750 | max 750 | max 750 |
| Composer padding | 8px | 16px | 24px | 24px |
| Editor row | 56px | 64px | 64px | 64px |
| Plan button | icon-only, 48px | icon + label | icon + label | icon + label |
| Reset button | 40px | 64px | 64px | 64px |
| Action buttons | icon-only, 44px targets | icon + label | icon + label | icon + label |
| AI status | badge only | badge only | badge + expanding caption | badge + expanding caption |
| Attachment stack | max 32vh, scroll | max 40vh, scroll | max 40vh | max 40vh |
| Bubbles | 92% | 85% | 85% | 85% |
| Drawer | overlay + backdrop, min(320, 88vw) | overlay + backdrop | 320px push | 320px push |
| Aurora | 35% band, fewer sparkles | 30% band | 30% band | 30% band |

---

## 8. File-by-file change map

| File | Change |
|---|---|
| `src/renderer/styles/Copilot.styles.ts` | Container width guards; alert wrapper inset fix. |
| `src/renderer/styles/copilot/ChatInput.styles.ts` | Fluid composer shell; responsive editor/reset/plan sizes; icon-only label hook. |
| `src/renderer/styles/copilot/ChatComposer.styles.ts` | Fluid bar; attachment max-height; responsive actions; advanced/file-list clamps; 44px targets. |
| `src/renderer/styles/copilot/Conversation.styles.ts` | Responsive padding, overscroll/scrollbar behavior. |
| `src/renderer/styles/copilot/MessageBubble.styles.ts` | Responsive bubble width. |
| `src/renderer/styles/copilot/AssistantMessage.styles.ts` | Row wrapping, `minWidth: 0`, long-path handling. |
| `src/renderer/styles/copilot/Welcome.styles.ts` | Responsive empty-state spacing. |
| `src/renderer/styles/copilot/SavedChatsDrawer.styles.ts` | Overlay-under-md, backdrop, capped width. |
| `src/renderer/styles/AiConnectionStatus.styles.ts` | Caption visibility under md. |
| `src/renderer/styles/copilot/Aurora.styles.ts` | Responsive blur/band sizing. |
| `src/renderer/components/copilot/ChatComposer.tsx` | `aria-label`s, label spans, tooltips. |
| `src/renderer/components/copilot/ChatInput.tsx` | Plan label span + accessible name. |
| `src/renderer/components/copilot/SavedChatsDrawer.tsx` | Backdrop, focus move/restore, Escape close. |
| `src/renderer/components/copilot/Aurora.tsx` | Container-based canvas sizing, reduced mobile work. |
| `src/renderer/pages/Copilot.tsx` | Wire drawer backdrop/close if owned by the page. |
| `e2e/specs/copilot-responsive.spec.ts` | New responsive E2E suite. |
| `src/renderer/__tests__/copilot-responsive.test.tsx` | New unit coverage for accessible icon-only actions/drawer. |
| `plans/COPILOT_RESPONSIVE_PLAN.md` | This plan. |

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Fixed widths still leak through a parent | Audit every fixed `width` in `styles/copilot`; use `maxWidth` instead of `width` where possible. |
| jsdom cannot verify layout | Assert behavior in unit tests; verify geometry/overflow in Playwright. |
| Icon-only actions hurt discoverability | Always pair with `aria-label` and `Tooltip`; restore labels at `sm+`. |
| Drawer overlay focus escapes to background | Move focus into the drawer, Escape closes, restore focus; add `inert` later if strict modal behavior is wanted. |
| Long translations overflow buttons/chips | Allow wrapping/ellipsis; test a long locale (e.g. German) if available. |
| Aurora mobile performance | Fewer sparkles, smaller blur, reduced motion honored. |
| Desktop visual regression | Keep the 750px ceiling and current spacing at `sm+`; only add fluid behavior below it. |
| Lint custom rules (`no-hardcoded-px`, inline styles) | Use `theme.typography.pxToRem`, `theme.spacing`, `styled()`; run all lint variants. |

---

## 10. Suggested delivery order

1. **PR 1 — Fluid shell + composer** (R1, R3, R4, R5, R6, R7, R12): the highest-impact overflow and reachability fixes.
2. **PR 2 — Conversation wrapping + alerts/welcome** (R8, R9, R10): content readability.
3. **PR 3 — Drawer overlay + aurora perf** (R2, R11): small-screen navigation and performance.
4. **PR 4 — Tests, RTL, and final gates** (R13, R14): new responsive E2E/unit tests and full verification.

---

## 11. Definition of done

1. No horizontal overflow at 320, 768, 960, 1280, and 1440px.
2. At 320px: composer, input, Plan button, all actions, advanced controls, attachments, and the saved-chats panel are all reachable without clipping.
3. Long file paths and plan rows wrap instead of overflowing bubbles/tables.
4. Saved chats overlays under `md` with a backdrop; desktop push behavior is unchanged.
5. Existing Copilot unit/E2E suites pass, and the new responsive suite passes at all widths.
6. `typecheck:renderer`, all lint variants, `test:a11y`, `validate:locales`, and `test:e2e` are green.
7. RTL and light/dark smoke checks pass; no new translation keys are required.
8. No changes to the planner/IPC contract or app-shell window sizing.
