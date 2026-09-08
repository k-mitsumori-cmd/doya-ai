# FV motion renewal — 2026-09-08

User request: make the first view immediately impressive, with substantially more animation. Scope: homepage and all 17 public service LPs. Existing product functionality, pricing and original before captures are preserved.

## Implemented

- Homepage: two-column composition, staged Japanese headline entrance and animated ink, a large Doya team, moving orbital paths and service icons, floating product screen with three service examples and manual selection.
- Service LPs: product screen enters in perspective and floats, a light sweep crosses the product illustration, Doya arrives, and three service-specific operation steps advance every 4.2 seconds.
- No new dependency, canvas or generation API. Existing approved Doya and product illustration assets are reused. Product illustrations remain labeled as such.
- Motion pause freezes CSS, pseudo-elements and timers. Manual selection holds the chosen state; replay resumes automatic progression. Timers pause when the scene is offscreen, when the document is hidden, or when reduced motion is requested. Static first-frame content is rendered before hydration.
- Existing dialog enlargement, mobile navigation, FAQ, workflow tabs, service filters and conversion links remain usable.

## Local validation

- `SKIP_DB_PUSH=1 npm run build`: passed. No database push.
- `npx tsc --noEmit`: passed.
- `verify-motion.cjs`: 66/66. All 18 routes advance and stay within mobile width; orbit movement, global pause/resume, keyboard selection, replay, offscreen pause, reduced motion, product/pseudo-element/progress freeze, and native dialog opening verified.
- Prior interaction suites: 35/35 + 15/15.
- Layout audit: 18 routes at 1440 / 1024 / 768 / 390 / 320 px, 90 layouts, no horizontal overflow or clipped text. Axe checks at 1440 and 320 px: 36 cases, zero reported violations. See `layout-summary.json`.
- Visually inspected the homepage and banner LP at desktop and mobile sizes, including 320 px, plus an 18-page desktop contact sheet. Corrected the multi-line gradient rendering, mobile scene height, product caption layering and scene-control overlap.
- Timer tests run sequentially in one browser page; parallel tabs intentionally trigger the visibility pause and cannot be used to assert continuous playback.

## Publication and comparison

Publication verification is recorded in `release.json` after deployment. The comparison generator retains the original before images, refreshes all 36 desktop/mobile pairs, and includes expandable actual-browser video recordings for the homepage and banner LP. Other service animations are accessible from each comparison's live-LP link.

The preceding quality revision is archived as `after-quality-20260908-0015` under the external comparison artifact folder. New static captures pause motion through the actual page control after the entrance and image decoding; video captures retain the animation. Static images do not claim to reproduce motion.

Browser recording: `DOYA_QA_URL=https://doya-ai.surisuta.jp node reference/lp-motion-2026-09-08/record-motion.cjs`. Recordings are remuxed into seekable WebM files without re-encoding.
