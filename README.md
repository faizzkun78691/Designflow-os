# DesignFlow OS

**AWS Community Karachi** — Design team operations platform.

A full-stack web application for managing the AWSCD design team: task management, design submissions, approval workflows, publishing studio, executive command center, leaderboards, and real-time analytics.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **Deployment:** Netlify

## Features

- Role-based dashboards (Organizer, Team Lead, Designer, Social Media Manager)
- Task lifecycle: creation → claiming → submission → review → approval → publishing
- Username-based login (no email required for team members)
- Publishing Studio with scheduling
- Executive Command Center with real-time metrics
- Designer leaderboard and performance analytics
- Team management with secure Edge Function admin API

## Getting Started

```bash
npm install
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Project Structure

- `src/` — React frontend
- `supabase/migrations/` — Database schema (11 migrations)
- `supabase/functions/team-admin/` — Admin Edge Function

## Live

https://designflow-os-v4.netlify.app
