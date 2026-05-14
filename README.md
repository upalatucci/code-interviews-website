# Code Interview Platform

Async code interview platform built for Vercel. Send candidates a unique link; their code is saved as they type so you can review it afterwards.

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init && git add . && git commit -m "init"
gh repo create code-interviews --public --push
```

### 2. Import to Vercel

Go to [vercel.com/new](https://vercel.com/new), import your repo.

### 3. Create a Postgres database

In your Vercel project → **Storage** → **Create Database** → **Neon Postgres**.  
Connect it to your project — the `POSTGRES_URL` env var is injected automatically.

### 4. Set your admin key

In Vercel project → **Settings** → **Environment Variables**:

| Name        | Value              |
|-------------|-------------------|
| `ADMIN_KEY` | your-secret-key   |

### 5. Deploy 🚀

Redeploy (or push a commit) — the database schema is created automatically on first request.

---

## Local development

```bash
npm i -g vercel
vercel link          # link to your Vercel project
vercel env pull .env.local   # pulls POSTGRES_URL + ADMIN_KEY
vercel dev           # runs locally with live Postgres
```

Open http://localhost:3000/admin.html

---

## Workflow

1. **Admin panel** `/admin.html` — log in with your `ADMIN_KEY`
2. **Create a challenge** — title, description, starter code, language
3. **Generate a link** — enter candidate name → get `/interview/<token>`
4. **Send the link** to the candidate
5. **Review** — Submissions page → View code → browse full save history

## Tech stack

- **Runtime**: Vercel Serverless Functions (Node.js)
- **Database**: Neon Postgres (via Vercel Storage integration)
- **Editor**: Monaco (VS Code engine, via CDN)
- **Frontend**: Vanilla HTML/CSS/JS — no build step
