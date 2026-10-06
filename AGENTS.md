# AGENTS.md — The Nexus

## Project mission
The Nexus is a Next.js + Supabase web app for running SSBU crew leagues. It supports onboarding directors/players/mods, managing match operations, and exposing stats/leaderboards.

## Stack and architecture
- Frontend: Next.js App Router (`frontend/app`), deployed on Vercel.
- Data: Supabase Postgres schema + SQL seed files in `supabase/`.
- Assets: branding, backgrounds, fonts, and logos are in `frontend/public` and should be reused for all new UI.

## Key product routes
- `/` landing page with three sections (season/matches hero, Join The Nexus CTA, dynamic broadcast panel fed by upcoming/live matches plus recent completed VOD links) plus a lightweight community footer.
- `/onboarding` runs mandatory first-login onboarding (first name, last name, user-chosen tag, role, optional avatar plus optional X/Twitter and Discord handles), then redirects completed users to `/dashboard`; new profiles must start with an empty tag rather than an automatically generated fallback.
- `/dashboard` is the authenticated user hub and redirects incomplete profiles to `/onboarding`; directors without a team are prompted to register or claim their school first; registered-school directors see placeholder enrollment tiers (Basic Membership $700, Asynchronous Support $1,500, Synchronous Support $3,000) that open a contact email flow; directors see their full roster, each player's linked-account status, and can promote linked players to Captain; players see Roster guidance explaining that school linking requires a director-issued invite link. Director match operations list every `upcoming` or `live` match involving their team, with live-room entry grayed out and locked for directors and players until one hour before the scheduled start. Moderators instead see the next eight upcoming or live matches across all teams and can enter any listed live room immediately.
- `/matches` sizes upcoming artwork with the same `2160 / 2600` aspect ratio as past-match graphics so desktop card dimensions align while mobile sizing remains content-driven. Upcoming cards display a "Watch on YouTube" stream CTA only when an attached stream link is present, or a scheduled match status when unstreamed; past cards show graphic + round-by-round stock/score breakdown with 8 cards per page numbered pagination, a real-time team/player search filter, and a dynamic floating Table of Contents that tracks the active page's matches.
- `/matches/[match]` individual match detail; upcoming matches link to their configured stream or The Nexus YouTube channel by default.
- `/schedule` is the public, interactive month calendar for all past, live, and upcoming matches; selecting a date reveals its match cards, which link to `/matches/[slug]`.
- `/matches/[match]/live` interactive live crew-battle room where directors or promoted team captains check in; initial hydration, reconnect recovery, and fallback polling use the canonical `get_live_match_room_snapshot` RPC; stale realtime rows never roll back client revisions, safe optimistic-concurrency conflicts retry automatically against the server-returned state, turn-bound stage actions refresh without replaying a stale actor, and each team's unconfirmed player and character draft survives revision refreshes caused by the other team. There is no separate starting-roster lock. Each game's opening send uses a server-confidential double blind (each team selects and submits two Round 1 starters, both selections reveal only after both are submitted, then each team chooses one), before stage striking, score verification, and participant chat. Full double-blind and stage-strike choice sets cycle out the oldest selection when a new available option is chosen. Tied RPS throws are announced to both teams and atomically clear both choices so each team must submit a fresh throw; the RPS action retains its original three-argument RPC overload for open rooms during frontend/database rollouts, while current clients also bind throws to the tie generation. The RPS winner owns Round 1’s opening strike and final pick in the 1-2-1 sequence; the frontend uses the four-argument stage RPC so the server resolves and authorizes the acting team without accepting a client-supplied actor UUID, every stage submission logs paired client/server preflight data and blocks locally when server/client strike counts disagree, and canonical snapshots use null-safe game matching so confirmed stage actions remain visible even before a live game ID is assigned. The team reviewing a reported score can dispute it, which clears the report and prompts both teams to report the round again. Stage actions are transient and are cleared atomically when a game ends so the next game's Round 1 strike starts clean. The testing reset is visible and executable only for moderators, who can use it in any match; it removes all live-session games and their round data so the next run starts with a clean game 1. Chat initially loads a bounded recent window, offers explicit earlier-message pagination, and reconciles realtime inserts individually.
- Match detail routes should use slugs in the form `/matches/[home]-vs-[away]-[date]`.
- `/standings` standings hub with a tournament/season-filtered league leaderboard; Season 1 - Fall 2026 is the default context, and seasons with registered seeded teams display all participating crews in seed order until matches complete.
- `/standings/[slug]` shared resolver for both player and team pages (use tags like `nova` and team codes like `flx`).
- `/stats` is the public stats command center with tabbed Players and Teams tables and an all-context-by-default tournament/season filter. Player stats derive matches played, games played, Attendance (player games played divided by completed games involving their team), stocks taken, MVP%, match W/L record, and W/L ratio from completed crew rounds and team game totals. Team stats derive stocks taken, matches played, games played, match W/L record, and W/L ratio from completed matches and games. Table player/team names link to `/stats/players/[tag]` and `/stats/teams/[team-code]` profile pages with a shared responsive profile shell, their own tournament/season dropdown, visible competition context, summary cards, and branded detail panels; team profiles show their current active roster from canonical `players.team_id` assignments (independent of historical stats), plus their most common lead and anchor from each side's first and last player in completed game data; player profiles display a roster Captain badge when `players.is_captain` is set, their four most-played characters with per-game usage percentages, and stage preference percentages based only on the counterpicks they made when entering after their team lost the prior round. Each stage preference expands to show the opposing player and character for every selection and links directly to that game on the match detail page.
- `/rulebook` is the branded, responsive web edition of the complete Spring 2026 SSBU Nexus Teams rulebook, with anchored navigation and a download link to the source document.
- `not-found.tsx` (`/_not-found`) is the branded custom 404 page with SSBU "Stock Lost / Out of Bounds" theme, ambient glow backdrops, Return Home / View Matches CTAs, and a responsive 4-card quick jump grid to Matches, Schedule, Stats, and Rulebook.
- `/privacy` is the public Privacy Policy page outlining participant information, public esports competition data handling, authentication security, and contact information.
- `/about` is the public-facing introduction to The Nexus, covering its mission, crew-battle format, match-night journey, audiences, and community values.
- `/signup` signup + login flow entry; new-account requests send the complete default `public.users` profile contract (empty tag and social fields, `player` role), which the server persists after Auth succeeds rather than from an `auth.users` trigger; failed email/password signups display the failure stage, technical detail, and a support reference that matches the server log entry.
- `/roster/claim/[token]` previews and confirms a single-use roster invitation, preserving the destination through signup and OAuth.
- `/auth/callback` OAuth completion route for social providers (Google/Discord), then redirects to the requested in-app destination.
- `/join` director payment/league enrollment page.
- `/tournaments` lists tournament and season contexts with an explicit competition type and open/closed registration lifecycle; cards link to `/tournaments/[slug]`, the public seeded-field and bracket detail page. The adaptive projected bracket remains visible before matches are scheduled, expands into winner/loser rounds as teams are added, reduces to Winners Final and Grand Final for a one-team field, and highlights upcoming matches in green. Only open contexts let authenticated directors register the team they manage, and the legacy singular route permanently redirects here.
- `/school-registration` is the director-facing school registration and unlinked-school claim flow launched from the dashboard, keeping normal director registration out of the moderator admin portal. School/team logo upload fields show guidance to use transparent, preferably square artwork, with SVG preferred and PNG/WebP also supported.
- Director roles (`director`, `member_director`, `pro_director`, and `exclusive_director`) are functionally director-equivalent for school registration and team operations; payment/enrollment is currently a dashboard contact placeholder.
- `/admin/update-team` routes moderators into the shared team editor, where rosters are managed through canonical `players.team_id` assignments; standalone players without user accounts are supported.
- `/admin/update-match` lets moderators select an existing match for editing or permanent deletion; the editor can swap home and away sides together with scores, roster sizes, and crew-round data before saving.
- `/admin/add-graphics` lets moderators upload artwork to any team's graphics repository. Team members can access that repository on `/dashboard`, and it is also public on `/stats/teams/[team-code]`.
- `/admin/tournaments` lets moderators classify contexts as tournaments or seasons, set season length in weeks, open or close registration, attach and order seeded teams, choose Double Elimination or Round Robin, and preview the resulting bracket. Round Robin seasons start from a generated weekly schedule that moderators can customize by moving, adding, or deleting matchups and setting each match date/time through a picker (not typed input); Week 1 can populate every later week at seven-day intervals. Saving publishes those matches to schedules and dashboards, while each team remains limited to one match per week.
- App Router navigations use the shared branded loading state in `frontend/app/loading.tsx`; route-specific client loading states should reuse `RouteLoader`.

## Data model expectations
Keep these core tables in sync with UI:
- `users`: `email`, `first_name`, `last_name`, nullable `tag`, `role`, `avatar`, `x_handle`, `discord_handle`; `tag` stays null until onboarding collects the user's selection, and role supports `director`, `member_director`, `pro_director`, `exclusive_director`, `player`, and `mod`
- `tournaments_seasons` / `tournament_season_teams` / `tournament_season_matchups` (shared tournament/season contexts, their eligible teams, season week count, and generated Round Robin weekly pairings; moderators manage them through `/admin/tournaments`)
- `matches` (references `tournaments_seasons` through `tournament_season_id`; do not use a `week` field; use `slug` + `date` for match identity; status supports `upcoming`, `live`, and `completed`)
- `match_director_check_ins` / `match_end_confirmations` (director-side operations tables that trigger `matches.status` transitions)
- `games` (linked to `matches`, one or more games per match)
- `games.game` and `games.home_roster_size` / `games.away_roster_size` drive crew stock calculations. In the live room, Ultimate is always a four-player roster with three stocks per player (12 team stocks), regardless of stored roster-size values.
- `games.graphic` is used for past-match card artwork.
- `match_crew_rounds` (crew send order, character image, stock progression, linked by `game_id`)
- `live_match_states`, `live_match_roster_selections`, `live_match_blind_picks`, `live_match_stage_actions`, `live_match_messages` (in-progress match operations and chat); blind-pick rows are exposed only through a server-filtered snapshot, and sensitive transitions use revision-checked transactional RPCs rather than direct client writes
- `players` (`is_captain` grants a linked player team check-in and live match operation access)
- `player_roster_invites` (hashed, expiring, revocable single-use links that attach an authenticated user to an existing unlinked player)
- `teams` (`school_site_url` optionally links to the school's esports/team site; `graphics` is a JSON object containing the team's named artwork; `tier` is numeric: 0 non-member, 1 base membership, 2 synchronous support membership, 3 synchronous support membership)

When adding columns, update:
1. SQL schema (`supabase/schema.sql`)
2. SQL seed (`supabase/seed.sql`)
3. Frontend typings (`frontend/lib/data.ts` and API callers)

## Development workflow
1. Read `docs/dev_outline.md` for current product intents before major changes.
2. For UI updates, prioritize shared styles in `frontend/app/globals.css` and keep a branded aesthetic.
3. For new data features, prefer server-side fetches from Supabase; static mock data is acceptable for early scaffolding.
4. Keep route pages focused: heavy domain logic should live in `frontend/lib`.
5. Keep `/matches` lightweight: emphasize match graphics + summary, and route full crew progression to `/matches/[match]`.

## Coding conventions
- TypeScript strict mode should stay enabled.
- Avoid introducing new UI frameworks unless requested.
- Prefer small composable components over very large pages.
- Avoid dead routes: if route changes, update navigation links in `frontend/app/layout.tsx`.
- Always follow `docs/brand_guideline.png` and `DESIGN.md` for UI colors/typography/components; avoid off-palette colors in production UI.
- **Terminology rule**: NEVER use the word "fixture". Always use "match" or "matchup" across all UI text, copy, documentation, and design specifications.

## Operations scripts
- Production migration push script: `scripts/push_migrations_prod.sh`.
- Reads env vars from `/.env.local` first, then `/frontend/.env.local`.
- Requires `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, and `SUPABASE_DB_PASSWORD`.

## Testing/checking expectations
Run, at minimum, from `frontend/`:
- `npm run lint`
- `npm run build`

## Deployment notes
- Vercel project root should be `frontend/`.
- Google Cloud Run deployments use the root multi-stage `Dockerfile`; public `NEXT_PUBLIC_*` values are build arguments, while server-only credentials must be runtime secrets.
- Set env vars from `frontend/.env.example` in Vercel and local `.env.local`.
- Ensure `NEXT_PUBLIC_SITE_URL` matches the active frontend domain for OAuth callback generation.
- OAuth profile sync requires `SUPABASE_SERVICE_ROLE_KEY`, and Resend audience sync requires `RESEND_API_KEY` + `RESEND_AUDIENCE_ID`.
- Apply SQL from `supabase/schema.sql`, then `supabase/seed.sql`.

## Documentation hygiene
After meaningful feature updates, update:
- this `AGENTS.md`
- route/data notes in README (if present)
- any SQL seeds affected by new demo flows

- `/admin/reassign-director` lets moderators review all director-equivalent accounts and move one to a destination team through the transactional `reassign_team_director` RPC; replacing an existing destination director requires explicit confirmation.
