# kong-kai-devportal

Developer Portal untuk Kong Gateway (padanan WSO2 DevPortal).
Spec: docs/superpowers/specs/2026-07-06-kong-devportal-design.md (repo kai workspace).

## Setup dev

1. Pastikan stack kong docker jalan (`kong/docker` di workspace kai) — PostgreSQL di :6432.
2. `docker exec kong-postgres psql -U kong -c "CREATE DATABASE kong_devportal;"`
3. `cp .env.example .env.local` lalu isi (AUTH_SECRET: `openssl rand -base64 32`).
4. `npm install && npm run db:migrate && npm run seed:admin`
5. `npm run dev` → http://localhost:3000 (admin: ADMIN_EMAIL/ADMIN_PASSWORD di .env.local)

Tanpa SMTP, link verifikasi email dicetak ke console dev server.
