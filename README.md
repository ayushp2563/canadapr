# 🍁 CanadaPathways AI — Canada PR Immigration Assistant

An AI-powered immigration assistant that provides expert guidance on Canadian Permanent Residency pathways, with real-time IRCC data, Express Entry draw tracking, and RAG-powered answers.

## ✨ Features

- **Groq-powered LLM** (llama-3.3-70b-versatile) for fast, accurate immigration Q&A
- **Mistral fallback** — automatic failover when Groq is rate-limited
- **Real-time Express Entry draw tracking** — scraped directly from IRCC tables
- **RAG (Retrieval-Augmented Generation)** — ChromaDB vector store with IRCC content
- **IRCC RSS feed monitoring** — policy changes and announcements every 30 min
- **Streaming responses** via Server-Sent Events
- **React chat UI** — Canadian red/white dark theme, draw sidebar, quick actions
- **PostgreSQL draw history** with stats and filtering

## 🏗️ Architecture

```
React UI (Vite + Tailwind) → Express API → LLM Router → Groq / Mistral
                                        ↓
                                   RAG Retriever → ChromaDB
                                        ↓
                                   PostgreSQL (draw history)
                                        ↑
                          node-cron → IRCC Scraper (Playwright + Cheerio)
                                   → RSS Watcher
```

## 📋 Prerequisites

- Node.js ≥ 20
- pnpm (or npm)
- Docker + Docker Compose
- Groq API key (required)
- Mistral API key (for fallback)

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd canada-immigration-assistant

# Install backend deps
npm install

# Install UI deps
cd ui && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and fill in your API keys
```

Required variables:
```env
GROQ_API_KEY=gsk_...
MISTRAL_API_KEY=...
DATABASE_URL=postgresql://canadapr:canadapr_pass@localhost:5432/canada_immigration
CHROMA_URL=http://localhost:8000
```

### 3. Start Docker Services

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on port 5432
- **ChromaDB** on port 8000

### 4. Set Up Database

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database
```

### 5. Initial Data Scrape

```bash
# First-time only: install Playwright's Chromium browser
./node_modules/playwright/cli.js install chromium

# Scrape IRCC pages and Express Entry draws
npm run scrape:once
npm run draws:check

# Embed content into ChromaDB
npm run embed:all
```

### 6. Start the API Server

```bash
npm run dev
# API available at http://localhost:3001
```

### 7. Start the React UI

```bash
cd ui
npm run dev
# UI available at http://localhost:5173
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Chat with streaming SSE response |
| `GET` | `/api/draws/latest` | Latest 10 Express Entry draws |
| `GET` | `/api/draws/history` | Draw history with filtering |
| `GET` | `/api/announcements/latest` | Latest IRCC announcements |
| `GET` | `/api/health` | Service health check |
| `POST` | `/api/draws/webhook/new-draw` | Trigger manual draw check (API key required) |

### Chat Request Example

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What was the latest Express Entry draw?",
    "language": "en"
  }'
```

Response is streamed as SSE events:
```
event: start
data: {"sessionId":"...","sources":[...],"draw_data":{...}}

event: chunk
data: {"text":"The latest Express Entry draw..."}

event: done
data: {"model_used":"llama-3.3-70b-versatile","provider":"groq","fallback_used":false}
```

## 🤖 Model Routing

| Query Type | Model Used |
|-----------|-----------|
| Simple lookups, draw summaries | `llama-3.1-8b-instant` (Groq fast) |
| Complex eligibility Q&A | `llama-3.3-70b-versatile` (Groq primary) |
| Deep policy analysis | `llama-3.3-70b-versatile` → Mistral fallback |
| Groq rate-limited (429/503) | `mistral-large-latest` (Mistral fallback) |

## ⏰ Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Draw check | Every 2 hours | Scrape IRCC draw table |
| Full IRCC scrape | Daily 6 AM UTC | Re-scrape all pathway pages |
| RSS check | Every 30 min | IRCC Atom feed |
| Content embed | Daily 2 AM UTC | Embed new content into ChromaDB |

## 🧪 Running Tests

```bash
npm test        # Run all unit tests
npm run test:watch  # Watch mode
```

Tests cover:
- CRS score extractor (7 cases)
- Draw table HTML parser (4 cases)

## 🏗️ Project Structure

```
├── src/
│   ├── config/          # Model configs, env validation
│   ├── llm/             # Groq client, Mistral client, router
│   ├── scraper/         # IRCC scraper, draw tracker, RSS watcher
│   ├── rag/             # Embeddings, ChromaDB, retriever
│   ├── api/             # Express server, routes, middleware
│   └── scheduler/       # Cron jobs
├── ui/                  # React + Vite + Tailwind chat UI
├── prisma/              # Database schema
├── tests/               # Unit tests
└── docker-compose.yml   # PostgreSQL + ChromaDB
```

## 🔐 Security

- Input sanitization with Zod validation
- Jailbreak detection patterns
- Off-topic query rejection
- API key protection for webhook endpoints
- Helmet.js security headers

## ⚖️ Disclaimer

This tool provides general immigration information only and **does not constitute legal advice**. For your specific situation, consult a licensed [RCIC (Regulated Canadian Immigration Consultant)](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigration-citizenship-representative/choose.html) or immigration lawyer.
