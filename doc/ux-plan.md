# Mobile UX Plan

## 1. Navigation model

Use a bottom navigation bar with four destinations:

1. **Home** — recent subjects, continue studying, daily usage.
2. **Library** — subjects, materials, search, and filters.
3. **Practice** — quiz history, scores, and retry actions.
4. **Profile** — preferences, usage, privacy, and sign out.

The Tutor is contextual rather than a global empty chat. It opens from a subject or material so that the source scope is always visible.

On wider screens, the bottom bar can become a left sidebar while keeping the same information architecture.

## 2. Screen inventory

| Screen | Main content | Primary action |
| --- | --- | --- |
| Welcome | Value proposition and privacy note | Get started |
| Register / Sign in | Authentication form | Continue |
| Onboarding | Education level and answer preference | Finish setup |
| Home | Greeting, usage meter, recent subjects, activity | Add material |
| Library | Search, subject cards, filters | New subject |
| Subject detail | Materials, saved summaries, quiz activity | Add material |
| Add material | Title, pasted text, tags, live character count | Save material |
| Material detail | Source preview and generated artifacts | Summarize / Quiz / Ask tutor |
| Summary setup | Style and length controls | Generate |
| Summary result | Structured sections, copy, regenerate | Start quiz |
| Quiz setup | Question count and difficulty | Generate quiz |
| Quiz session | One question per view, progress, choices | Next / Submit |
| Quiz result | Score, explanations, weak concepts | Retry mistakes |
| Tutor | Source scope, messages, quick prompts, composer | Send |
| Profile | Preferences, usage, privacy, account actions | Save changes |

## 3. Key mobile layouts

### Home

- Compact header with avatar and notification-free status area.
- Daily AI allowance shown as text plus a progress bar; never rely on color alone.
- “Continue studying” card for the last active subject.
- Horizontally scrollable recent subjects with adequate focus behavior.
- Floating or fixed “Add material” action above the bottom navigation.

### Material detail

- Sticky title bar and compact metadata.
- Segmented tabs: Source, Summary, Quizzes.
- Three large action buttons: Summarize, Make quiz, Ask tutor.
- Source is collapsed initially after a generated artifact is selected.

### Quiz

- Present one question at a time to avoid a long mobile form.
- Use full-width choice buttons with at least a 44px touch target.
- Persist each selection locally and on the server so an interrupted quiz can resume.
- Confirm before final submission; do not reveal correctness before submission.

### Tutor

- Show a pinned, removable source-scope chip above the conversation.
- Keep the composer above the virtual keyboard using safe-area padding.
- Render streaming status accessibly, with a Stop button.
- Put source references under the answer as expandable chips.
- Long-press is not required for any action; copy and retry actions are visible.

## 4. State design

Every feature needs intentional states:

- Empty: explain the next useful action.
- Loading: show skeletons for reads and a named progress state for AI work.
- Streaming: show partial text, stop control, and reconnect behavior.
- Success: show the saved result and related next action.
- Validation error: keep all entered material and focus the first invalid field.
- Provider error: explain that the source is safe and allow retry.
- Quota error: show reset time and keep existing content accessible.
- Offline: allow navigation through cached shell and previously cached reads; queue no AI generation.

## 5. Visual direction

- Calm, academic visual language with high contrast and restrained decoration.
- Neutral background, one primary brand color, and semantic success/warning/error colors.
- Rounded cards and controls, but retain clear grouping and hierarchy.
- Base text of 16px; avoid small metadata below 12px.
- Use system fonts initially for speed and legibility.
- Respect device safe areas and both light and dark color schemes.

## 6. Tailwind approach

- Define semantic design tokens with CSS custom properties and expose them through Tailwind.
- Build reusable primitives: Button, IconButton, Input, Textarea, Card, Badge, Dialog, Sheet, Tabs, Toast, Skeleton, Progress, and EmptyState.
- Use a consistent spacing scale and content width rather than page-specific arbitrary values.
- Prefer responsive utilities and CSS container queries over device-name breakpoints.
- Use a class-merging helper and variant utility to keep component states predictable.

## 7. Accessibility acceptance criteria

- All form controls have programmatic labels and useful error messages.
- Focus is trapped and restored correctly in dialogs and mobile sheets.
- Dynamic AI and status updates use restrained live regions.
- Choice correctness includes icon and text, not color only.
- Contrast meets WCAG AA.
- Motion is disabled or reduced when `prefers-reduced-motion` is set.
- Screen readers can identify quiz position, selected answer, and score.
- Touch targets are at least 44 by 44 CSS pixels where possible.

## 8. PWA behavior

- Provide a web app manifest, icons, theme color, and standalone display mode.
- Cache versioned static application assets.
- Use a network-first strategy for authenticated API reads with a small, explicit cache for non-sensitive shell data.
- Do not cache access tokens, raw AI requests, or private API responses in the service worker cache.
- Show an install prompt only after the user has completed a meaningful action.
- Show a refresh banner when a new application version is ready.
