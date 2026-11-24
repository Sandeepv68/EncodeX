# PostHog Error Tracking

> ⚠️ **Needs your attention**
> - In GitHub repository **Settings → Secrets and variables → Actions**, create `POSTHOG_API_KEY` with source-map/error-tracking write access.
> - Create the `POSTHOG_PROJECT_ID` Actions secret with value `709196`.
> - Verify that the existing `POSTHOG_HOST` Actions secret is present and points to the configured PostHog host; keep the existing `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` runtime secrets for packaged apps.

## What you still need to do

1. Create a personal API key at [PostHog source-map upload keys](https://us.posthog.com/source-maps-key), using the **Source map upload** preset. The local `.env` already has the required credential, but the production GitHub Actions workflow needs its own repository secret.
2. In GitHub repository **Settings → Secrets and variables → Actions**, add:
   - `POSTHOG_API_KEY`: the personal API key from step 1.
   - `POSTHOG_PROJECT_ID`: `709196`.
   - Verify `POSTHOG_HOST` is present for the workflow. Keep `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` configured for the packaged runtime.
3. The production deployment path is `.github/workflows/release.yml`, in the `package` job at the `Build ${{ matrix.arch }} ${{ matrix.target }} installer` step. After those secrets are present, the next tagged release will upload its source maps.

## What is working now

Uncaught errors reach PostHog through the configured SDK integrations:

- Renderer errors use `posthog-js` exception autocapture in `src/renderer/surveys/posthogSurveys.ts`.
- Main-process errors use `posthog-node` exception autocapture in `src/main/analytics/posthogMainProvider.ts`.
- Electron child-process failures remain explicitly captured in `src/main/index.ts`.
- React render errors continue through the existing global error boundary and consent-aware relay.
- The removed duplicate browser and Node global listeners are covered by the SDK integrations; Sentry's independent renderer integration remains enabled in `src/renderer/monitoring/sentryRendererProvider.ts`.

This project already had PostHog installed and initialized; this work extends the existing setup with built-in exception capture rather than adding a new SDK. The existing generated build configuration and IPC path continue to provide the configured token and host to packaged builds.

## Source-map upload

Source-map upload was wired in these files:

- `vite.config.ts`
- `package.json`
- `package-lock.json`
- `.github/workflows/release.yml`

The exact production build command is `npm run build` locally, and the tagged production workflow invokes `npm run dist`, which rebuilds the renderer. The Vite configuration is set up to upload source maps on production builds when `POSTHOG_API_KEY` and `POSTHOG_PROJECT_ID` are available, and to delete uploaded maps afterward. The GitHub Actions production package job now passes those variables to the build, so every production release build uploads once the repository secrets are present.

The local verification build passed with `npm run build`: the uploader created a release, found 62 source-map pairs, and uploaded 62 chunks with 0 skipped. The exact generated release name was not retained in the handoff. No source maps remained in `dist/renderer` after the configured cleanup.

## Release linking

Release linking was not wired as a separate step. The existing build uploader can auto-detect release metadata from the checked-out GitHub environment, but no runtime `POSTHOG_RELEASE_ID` deployment injection was added. Local runs, tests, and pull-request builds remain unchanged.

## How to verify

1. Trigger any application error.
2. View exceptions at [PostHog Error Tracking](https://us.posthog.com/project/709196/error_tracking).
3. View uploaded symbol sets at [Error Tracking configuration](https://us.posthog.com/project/709196/error_tracking/configuration).
4. After the next tagged production release with the CI secrets configured, confirm that the resulting minified renderer stack traces are symbolicated.
