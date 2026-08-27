# Conversion Profiles — Implementation Plan

## Overview

Introduce a **profile system** where `Profile = name + container + video codec + audio codec + constraints/settings`. The feature spans 4 layers: **shared types → profile data/store → UI components → FFmpeg integration**.

---

## Checkpoints

| # | Phase | Status | Checkpoint |
|---|-------|--------|------------|
| 1 | Types | ✅ | `ConversionProfile` and `ProfileCategory` added to `shared/types.ts` |
| 2 | Catalogue | ✅ | `shared/profiles/` directory with builtin profiles + category metadata |
| 3 | Store | ✅ | `useProfileStore` with CRUD, persistence, and profile-to-form application |
| 4 | UI — Selector | ✅ | `ProfileSelector` component with grouped list |
| 5 | UI — Editor | ✅ | `ProfileEditorDialog` for creating/editing custom profiles |
| 6 | UI — Badge | ✅ | `ProfileBadge` inline indicator in conversion form |
| 7 | Integrate Convert | ✅ | `Convert.tsx` uses ProfileSelector + ProfileBadge |
| 8 | Integrate Batch | ✅ | `BatchEncodingPanel.tsx` uses ProfileSelector |
| 9 | extraArgs | ✅ | `extraArgs` / `inputArgs` fields on `ConversionOptions`, wired into transcoders |
| 10 | Custom FFmpeg | ✅ | Built-in "Custom FFmpeg" profile in Advanced category |

---

## Phase 1: Data Model

### 1.1 Add types to `src/shared/types.ts`

```typescript
type ProfileCategory =
  | 'web-social' | 'devices' | 'video' | 'professional'
  | 'streaming' | 'audio' | 'images' | 'advanced';

interface ConversionProfile {
  id: string;
  name: string;
  category: ProfileCategory;
  icon?: string;
  container: string;
  videoCodec: string;
  audioCodec: string;
  videoBitrate?: string;
  audioBitrate?: string;
  crf?: number;
  preset?: string;
  scale?: string;
  pixelFormat?: string;
  fps?: number;
  extraArgs?: string[];
  extension?: string;
  builtin: boolean;
  compatibility?: string;
  description?: string;
}
```

Also add `extraArgs?: string[]` and `inputArgs?: string[]` to `ConversionOptions`.

### 1.2 Create `src/shared/profiles/categories.ts`

Category metadata (label, icon, display order) for the 8 top-level groups.

### 1.3 Create `src/shared/profiles/builtin.ts`

~120-150 static profile objects covering:

| Category | Count | Examples |
|----------|-------|---------|
| Web & Social | ~20 | YouTube 4K/1080p/720p, Shorts, Instagram Reel/Story/Post, TikTok, Facebook, X |
| Devices | ~20 | iPhone 4K/1080p/720p, iPad, Apple TV, Android variants, PS4/PS5, Xbox, Switch |
| Video | ~30 | MP4/MKV/MOV/WebM/AVI × codec variants (H.264, H.265, AV1, VP9) × quality tiers |
| Professional | ~20 | ProRes (all tiers), DNxHD/HR, CineForm, FFV1, HuffYUV, Uncompressed |
| Streaming | ~10 | HLS/DASH × resolution, RTMP, SRT |
| Audio | ~20 | MP3/AAC/Opus/Vorbis × bitrate, FLAC/ALAC/WAV/AIFF, Dolby |
| Images | ~15 | JPEG, PNG, WebP, AVIF, TIFF, GIF, APNG |
| Advanced | ~5 | Raw YUV, Raw PCM, Null output, Custom FFmpeg |

### 1.4 Create `src/shared/profiles/index.ts`

Barrel export: `BUILTIN_PROFILES`, `PROFILE_CATEGORIES`.

---

## Phase 2: Profile Store

### 2.1 Create `src/renderer/stores/profileStore.ts`

Zustand store with:

- **State**: `profiles` (merged builtin + custom), `activeProfileId`, `selectedCategory`
- **Actions**:
  - `setActiveProfile(id | null)` — select a profile
  - `setSelectedCategory(cat | null)` — filter by category
  - `saveCustomProfile(data)` — create new user profile → localStorage
  - `updateCustomProfile(id, updates)` — edit user profile
  - `deleteCustomProfile(id)` — remove user profile
  - `getProfileById(id)` — lookup
  - `getProfilesByCategory(cat)` — filtered list
  - `applyProfileToConversionStore(profile)` — set all conversionStore fields from profile
  - `clearActiveProfile()` — deselect without changing form fields

### 2.2 Persistence

- Custom profiles stored in `localStorage('encodex-custom-profiles')`
- Loaded on store init, merged with `BUILTIN_PROFILES`
- Builtin profiles are immutable (no edit/delete)

---

## Phase 3: UI Components

### 3.1 ProfileSelector (`src/renderer/components/ProfileSelector.tsx`)

- Autocomplete / grouped dropdown with category sections
- Type-to-search across all profile names
- "Recently used" section at top (last 5, tracked in localStorage)
- "Custom Profiles" section with "+ Create New" button
- Selecting a profile calls `applyProfileToConversionStore()`
- Manual field edits clear the active profile

### 3.2 ProfileEditorDialog (`src/renderer/components/ProfileEditorDialog.tsx`)

- MUI Dialog with form fields for all profile properties
- Reuses `CodecSelect`, `GroupedSelect` for codec/format pickers
- Validates codec-container compatibility via `codec-containers.ts`
- "Advanced" accordion with raw FFmpeg args text input
- Only editable for user-created profiles

### 3.3 ProfileBadge (`src/renderer/components/ProfileBadge.tsx`)

- Small chip shown next to page heading when a profile is active
- Click `×` to deselect profile (keeps current field values)

---

## Phase 4: Page Integration

### 4.1 Convert page (`src/renderer/pages/Convert.tsx`)

- Add `<ProfileSelector />` between file input and codec settings
- Add `<ProfileBadge />` next to heading when profile active
- Manual edits to any field → clear active profile

### 4.2 BatchEncodingPanel (`src/renderer/components/BatchEncodingPanel.tsx`)

- Add `<ProfileSelector />` at top of batch config
- Profile selection populates `batchConfig` store fields

---

## Phase 5: Advanced Mode

### 5.1 extraArgs in transcoders

- `src/main/transcoders/ffmpeg-utils.ts`: splice `extraArgs` before output path in `buildFfmpegArgs()`
- `src/main/transcoders/ffmpeg-core.ts`: append via `cmd.outputOptions(...extraArgs)`

### 5.2 Custom FFmpeg profile

- Builtin profile in Advanced category: empty codecs, all fields blank
- User fills in everything via ProfileEditorDialog advanced panel
- Acts as a starting point for fully manual FFmpeg configuration

---

## Execution Order

```
Step 1  →  Step 2  →  Step 3  →  Step 4  →  Step 5  →  Step 6
 types     catalogue    store     selector    editor      badge
                                                         ↓
Step 10 ←  Step 9  ←  Step 8  ←  Step 7
customFF    extraArgs   batch      convert
```

Each step must pass typecheck before moving to the next.
