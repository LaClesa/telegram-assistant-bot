# Telegram Assistant Bot

An AI-powered personal assistant bot for Telegram built with NestJS, Claude Sonnet 4.6, Redis, and PostgreSQL. Supports private and group chats, file analysis, Google Workspace integration, and persistent memory.

## Prerequisites

- Node.js 22+
- PostgreSQL
- Redis
- A Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- An Anthropic API key
- (Optional) Google OAuth credentials for Google Workspace features

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example below into a `.env` file in the project root:

```env
# Required
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ANTHROPIC_API_KEY=your_anthropic_api_key
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/telegram_bot
REDIS_URL=redis://localhost:6379

# Security — must be a random 32-byte hex string (64 chars)
TOKEN_ENCRYPTION_KEY=your_64_char_hex_string

# Optional — Google Workspace integration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Optional — rate limiting (default: 20 requests/min per user)
RATE_LIMIT_PER_MINUTE=20

# Optional — webhook mode (leave empty for long-polling)
WEBHOOK_URL=https://yourdomain.com
```

Generate a secure `TOKEN_ENCRYPTION_KEY`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run the database

Make sure PostgreSQL and Redis are running. Tables are created automatically via TypeORM on startup.

---

## Running the bot

```bash
# Development (watch mode)
npm run start:dev

# Production build then run
npm run build
npm run start:prod
```

The bot starts in **long-polling** mode by default. Set `WEBHOOK_URL` to switch to webhook mode.

---

## Running with Docker

```bash
# Start all services (app + postgres + redis)
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f app

# Stop
docker compose -f docker-compose.prod.yml down
```

The `docker-compose.prod.yml` reads from `.env` automatically.

---

## Bot Commands

| Command | Description |
|---|---|
| `/start` | Introduction and feature overview |
| `/help` | Show all available commands |
| `/permissions` | View your granted permissions |
| `/forget` | Clear your conversation history |
| `/gdoc <url>` | Read or write a Google Doc |
| `/gsheet <url>` | Read or write a Google Sheet |
| `/gdrive` | List recent Drive files |
| `/glogout` | Disconnect Google account |
| `/enable` | (Group admin) Enable bot in the group |
| `/disable` | (Group admin) Disable bot in the group |
| `/groupsettings` | (Group) Show current group config |

### Permissions

The bot uses a scoped permission system. When a feature requires elevated access, it will ask for your approval before proceeding. Permissions include file access, messaging, API access, document modification, and more.

---

## Features

- **Conversational AI** — context-aware chat with Claude Sonnet 4.6, short-term Redis memory (2h) and long-term PostgreSQL memory with auto-summarisation
- **File analysis** — send images, PDFs, CSVs, Excel files, or text/code files for AI analysis
- **Google Workspace** — read/write Google Docs and Sheets, browse Drive files via OAuth 2.0
- **Group chat** — @mention or reply to the bot in groups; per-group session memory and admin controls
- **Rate limiting** — 20 req/min per user (private), 30 req/min per group (configurable)
- **Health endpoint** — `GET /health` returns DB and Redis status

---

## Project Structure

```
src/
├── ai/          — Claude AI service and system prompt
├── config/      — Environment configuration
├── database/    — TypeORM setup and entities
├── files/       — File extraction (PDF, image, CSV, Excel)
├── google/      — Google OAuth and Workspace services
├── groups/      — Group settings and admin logic
├── health/      — Health check endpoint
├── memory/      — Redis short-term + Postgres long-term memory
├── permissions/ — Permission scopes and grant/revoke logic
└── telegram/    — Telegraf update handlers (private, group, Google commands)
```

---

## Generating Documentation

A full user guide can be generated as a `.docx` file:

```bash
node scripts/generate-docs.mjs
```

Output: `Telegram-Assistant-Bot-Documentation.docx`
