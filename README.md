# The Nexus

**A full-stack platform for running collegiate esports leagues.**

The Nexus replaces the spreadsheets, forms, and Discord coordination traditionally used to operate collegiate leagues with a single system for registration, scheduling, standings, roster management, match reporting, and real-time match operations.

I built The Nexus from 0 → 1 around the needs of collegiate esports organizers and teams. **10+ schools signed up for the debut season.**

**Live:** [thenexus.gg](https://thenexus.gg)

---

## What it does

The Nexus supports the full lifecycle of a collegiate esports season:

- **School and team registration** — directors can register or claim their school and manage their team.
- **Roster management** — directors manage players, account linking, invitations, and captain permissions.
- **Tournament and season administration** — create competitive formats, seed teams, generate schedules, and manage registration.
- **Automated scheduling** — generate and customize weekly round-robin matchups across a season.
- **Standings and statistics** — track team and player performance across seasons and tournaments.
- **Match reporting** — record match results, game data, player order, characters, stages, and stock counts.
- **Real-time match rooms** — teams can operate a crew battle through check-in, player selection, stage striking, scoring, disputes, and completion.
- **League administration** — moderator tools provide centralized management of teams, tournaments, matches, graphics, and competition state.

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS, custom design system |
| Database | PostgreSQL |
| Backend / Auth | Supabase |
| Realtime | Supabase Realtime |
| Testing | Node test runner, TypeScript |
| Deployment | Production web deployment at thenexus.gg |

The frontend uses the Next.js App Router and is structured around server-rendered data where appropriate, interactive client components for match operations, and shared domain logic for competition state.

---

## Architecture

At a high level:

```text
                  ┌──────────────────────┐
                  │    Next.js / React   │
                  │    TypeScript UI     │
                  └──────────┬───────────┘
                             │
                 server routes / queries
                             │
                  ┌──────────▼───────────┐
                  │       Supabase       │
                  │                      │
                  │ Auth · PostgreSQL    │
                  │ Realtime · Storage   │
                  └──────────┬───────────┘
                             │
                   competition state
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
   Tournaments           Live Matches          Stats
   & Seasons             & Rosters          & Standings
```

The application models tournaments, seasons, teams, players, matches, games, crew-battle rounds, roster invitations, and live match state as related domain entities rather than treating the league as a collection of independent forms.

---

## Real-time match system

One of the most involved parts of The Nexus is the live crew-battle room.

A live match has to coordinate two independently controlled teams while keeping both clients synchronized through a multi-step competitive workflow:

```text
Check In
   ↓
Select Players
   ↓
Opening Player Selection
   ↓
Stage Striking
   ↓
Play Round
   ↓
Report Score
   ↓
Opponent Verification
   ↓
Next Player / Stage
   ↓
Match Completion
```

The implementation includes:

- role-aware access for directors, captains, and moderators
- synchronized team and roster state
- reconnect and recovery behavior
- revision-aware state updates
- optimistic client interactions with authoritative server state
- stage striking and counterpick workflows
- double-blind opening player selection
- score verification and dispute handling
- real-time participant chat
- moderator reset and recovery tooling

The goal was to make match administration feel like part of the game rather than a separate spreadsheet workflow.

---

## Tournament and season scheduling

The Nexus supports both tournament-style and season-style competition.

For round-robin seasons, league administrators can:

- select participating teams
- generate weekly matchups
- set the number of competition weeks
- move or replace matchups
- assign match dates and times
- propagate scheduling patterns across later weeks
- publish the resulting matches directly into team schedules and dashboards

The scheduling system keeps each team's competition constraints in mind while still allowing administrators to manually adjust the generated season.

---

## Roles and roster management

The application has several distinct permission levels:

```text
Moderator
    │
    ├── league administration
    ├── tournament management
    └── match oversight

Director
    │
    ├── team management
    ├── roster management
    └── match operations

Captain
    │
    └── delegated match operations

Player
    │
    ├── roster identity
    └── competition participation
```

Roster invitations use expiring, single-use links to connect an existing league player entry with an authenticated user account.

This lets league administrators build rosters before every player has created an account while preserving a path to link those records later.

---

## Stats and standings

The public statistics system derives player and team performance from recorded match data.

Examples include:

- team win/loss records
- player and team stock totals
- games and matches played
- player attendance
- character usage
- stage preferences
- lead and anchor tendencies
- tournament- and season-specific standings

Stats pages support competition filtering and dedicated player/team profiles rather than exposing only a single global leaderboard.

---

## Product and design

The Nexus has its own visual system built around a dark esports aesthetic with emerald and magenta brand accents.

The repository includes the design conventions used across the application in [`DESIGN.md`](./DESIGN.md), including:

- color tokens
- typography hierarchy
- component patterns
- interaction conventions
- responsive behavior

[`AGENTS.md`](./AGENTS.md) documents the architectural and product context used during AI-assisted development. I use coding agents as part of the engineering workflow while retaining responsibility for product decisions, architecture, review, debugging, testing, and deployment.

---

## Repository structure

```text
frontend/
├── app/                    # Next.js routes and UI
│   ├── admin/              # League administration
│   ├── dashboard/          # Team/player dashboard
│   ├── matches/            # Match history + live match rooms
│   ├── onboarding/         # New-user onboarding
│   ├── school-registration/
│   ├── stats/
│   ├── standings/
│   └── tournaments/
│
├── lib/                    # Shared domain and state logic
├── public/                 # Public brand and application assets
└── package.json
```

Some production infrastructure and internal operational material are intentionally not included in this public repository.

---

## Running locally

### Requirements

- Node.js
- npm
- a compatible Supabase project if you want to exercise backend-dependent functionality

Clone the repository and install the frontend dependencies:

```bash
cd frontend
npm install
```

Create your local environment file from the provided example:

```bash
cp .env.example .env.local
```

Then start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Useful checks:

```bash
npm run lint
npm run build
npm run test:live-match
npm run test:director-reassignment
```

---

## About this public repository

This repository is a **public source showcase** of The Nexus rather than the production source-of-truth repository.

Production credentials, security-sensitive deployment configuration, database administration tooling, internal business materials, selected third-party media assets, and other operational files are maintained separately.

The public repository focuses on the application architecture, product implementation, domain logic, user experience, and representative engineering work behind The Nexus.

---

## About the project

The Nexus was built to explore a fairly simple question:

**What would collegiate esports leagues look like if the software were designed around the league itself instead of forcing organizers to assemble one from spreadsheets, forms, and Discord channels?**

The result is a purpose-built platform that brings league administration and the match-day experience into the same product.

**Live product:** [thenexus.gg](https://thenexus.gg)  
**More of my work:** [bengoulet.com](https://bengoulet.com)
