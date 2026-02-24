# Hangman Realtime (Cloudflare Stack)

A modern, real-time multiplayer Hangman game built with Vue 3, Cloudflare Workers, and Durable Objects.

## Features
- **Single-player**: Play solo against the server (no login required).
- **Multiplayer**: Real-time sync with friends via WebSockets and Durable Objects.
- **Dynamic Rules**: Language select (EN/ET), time limits, and word length settings.
- **Rich UI**: Modern dark-mode aesthetic with smooth animations.

## Tech Stack
- **Frontend**: Vue 3, Vite, Pinia, TypeScript.
- **Backend**: Cloudflare Workers, Durable Objects.
- **Shared**: Common types and Zod schemas in a shared package.
- **Monorepo**: npm workspaces.

## Setup & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Locally

#### Start Backend (Worker + DO)
```bash
cd apps/realtime
npm run dev
```

#### Start Frontend (Vue 3 + Vite)
```bash
cd apps/web
npm run dev
```

### 3. Build & Deploy

#### Backend
```bash
cd apps/realtime
wrangler deploy
```

#### Frontend
Deploy to Cloudflare Pages:
- Build command: `npm run build`
- Output directory: `apps/web/dist`

## Configuration
Set these environment variables in your Cloudflare dashboard or `wrangler.toml`:
- `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID for multiplayer host login.
