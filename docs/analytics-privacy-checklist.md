# Analytics Privacy Checklist

Every pull request that touches `src/shared/analytics/` or `src/main/analytics/` must
answer all of these questions in the PR description. A "no" on any of them blocks
merge unless an explicit exception is recorded in `docs/ANALYTICS.md`.

1. **Categorical only.** Does every new or changed event property hold a value from
   a finite, closed set (enum, boolean, bucketed number, count)? No free text,
   no user input, no derived strings.
2. **No paths or names.** Does the payload avoid file names, folder paths, media
   titles, profile names, and any other user-chosen identifier?
3. **No content.** Does it avoid media content, prompt text, and completion text?
   AI content is metadata-only unless `POSTHOG_AI_CAPTURE_CONTENT=true`.
4. **Bounded cardinality.** Are new string properties from a closed enum with a
   small, known set of values? No unbounded IDs, hashes, or timestamps as
   dimension values.
5. **Consent-gated.** Is the event recorded only through the shared facade or the
   relay, so the consent check applies? No direct SDK calls from call sites.
6. **Group keys from enum.** If the event attaches a PostHog group, is the group
   key a member of the fixed enums in `src/main/analytics/groups.ts`?
7. **Person properties allowlisted.** If a new person property is added, is it in
   `src/shared/analytics/personProperties.ts` and coarse / non-identifying?
8. **Sanitizer.** Does the adapter path run `sanitizeAnalyticsProps`? (It does
   for both backends; verify no bypass was introduced.)
9. **Documentation.** Is `docs/ANALYTICS.md` updated for any new event, property,
   or configuration knob?
10. **Tests.** Are unit tests added or updated, and does `npm run
    analytics:schema-check` pass?
