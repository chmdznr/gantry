# kong-kai-devportal

Developer Portal untuk **Kong Gateway 3.9** — padanan WSO2 Developer Portal / Red Hat 3scale
Developer Portal. Aplikasi **standalone**, terpisah total dari kong-kai-be/fe (yang berperan
sebagai Publisher Portal).

- **Spec desain**: `../docs/superpowers/specs/2026-07-06-kong-devportal-design.md`
- **Progress ledger** (riwayat eksekusi per-fase): `.superpowers/sdd/progress.md`
- **Stack**: Next.js 16 (App Router, TypeScript, Tailwind) · Drizzle ORM · PostgreSQL · Auth.js v5

---

## 1. Konsep inti (WAJIB dibaca sebelum lanjut)

Aplikasi ini mengkurasi API yang di-serve Kong dan memberi developer credential self-service.
Pemetaan konsep:

| Konsep portal | Realisasi di Kong |
|---|---|
| **Application** (milik developer) | 1 Kong **consumer** (`username = app-<uuid>`, tag `devportal`) |
| **Credential** (API Key / JWT) | plugin `key-auth` / `jwt` pada consumer |
| **Subscription** (app → API, per plan) | membership **ACL group** + plugin `rate-limiting` (consumer+service) |
| **Plan / tier** | konfigurasi rate-limit (`{second,minute,hour,day}`) |
| **Blacklist** consumer | plugin `request-termination` pada consumer |
| **Analytics** per app | PromQL filter label `consumer` (butuh prometheus `per_consumer=true`) |

**Prinsip arsitektur yang menentukan banyak keputusan:**

1. **Kong = source of truth untuk routing & credential.** Portal tidak menyimpan secret
   credential (hanya `kong_credential_id` + 4 char hint); secret ditampilkan sekali saja.
2. **OpenAPI spec di portal = dokumentasi murni.** Mengubah spec TIDAK mengubah apa yang
   di-serve Kong. Karena itu "perubahan spec" ditangani sebagai histori+changelog dokumentasi
   (lihat §5), bukan operasi terhadap gateway.
3. **Boundary tegas**: portal HANYA menyentuh entity ber-tag `devportal` (consumer, credential,
   ACL, rate-limiting/request-termination milik consumer). Portal **tidak pernah** membuat/
   mengubah **service atau route** — itu ranah publisher. Portal hanya *membaca* service/route
   (checklist setup, import katalog, tampilan route read-only).
4. Semua akses Kong Admin API lewat satu modul: `src/lib/kong.ts`. Semua akses Prometheus lewat
   `src/lib/metrics.ts`. Keduanya server-side saja.

---

## 2. Setup dev

Prasyarat: stack `kong/docker` di workspace kai berjalan (Kong admin :8106, proxy :8104,
PostgreSQL :6432, Prometheus :9090).

```bash
docker exec kong-postgres psql -U kong -c "CREATE DATABASE kong_devportal;"   # sekali saja
cp .env.example .env.local     # isi AUTH_SECRET: openssl rand -base64 32
npm install
npm run db:migrate
npm run seed:admin             # admin dari ADMIN_EMAIL/ADMIN_PASSWORD di .env.local
npm run dev                    # http://localhost:3000
```

Login admin default: `admin@kai.id` / `admin12345` (dari `.env.local`).
Tanpa `SMTP_HOST`, semua link email (verifikasi, reset password) dicetak ke **console dev server**.

**Prasyarat first-run terhadap Kong**: buka `/admin/setup` sebagai admin — halaman ini
memverifikasi koneksi + prasyarat dan punya tombol **auto-fix** untuk plugin prometheus
`per_consumer`. Jalankan sekali setelah connect ke Kong baru.

### Environment variables

| Var | Wajib | Guna |
|---|---|---|
| `DATABASE_URL` | ✓ | PostgreSQL portal (fail-fast kalau kosong) |
| `AUTH_SECRET` | ✓ | Auth.js + HMAC captcha token |
| `KONG_ADMIN_URL` | ✓ | Kong Admin API (dev `http://localhost:8106`) |
| `PORTAL_BASE_URL` | ✓ | basis link email |
| `INTERNAL_EMAIL_DOMAINS` | – | domain → user `type=internal` (default `kai.id`) |
| `PROMETHEUS_URL` | – | analytics per-app; kalau kosong analytics dinonaktifkan |
| `KONG_PROXY_URL` | – | default proxyBaseUrl saat import katalog (dev `http://localhost:8104`) |
| `SMTP_HOST/PORT/USER/PASS/FROM` | – | email; kalau kosong → console fallback (dev). Auth opsional (relay internal tanpa auth didukung) |
| `ADMIN_EMAIL/ADMIN_PASSWORD` | – | dipakai `npm run seed:admin` |

---

## 3. Perintah

```bash
npm run dev            # dev server (Turbopack)
npm run build          # production build (output: standalone)
npm test               # vitest (26 test)
npm run db:generate    # buat migrasi dari perubahan src/db/schema.ts
npm run db:migrate     # terapkan migrasi
npm run seed:admin     # buat/update user admin
```

Docker: `Dockerfile` (multi-stage, standalone, jalankan `scripts/migrate.mjs` saat start lalu
`server.js`). **Belum pernah di-build/push** — deploy remote sengaja tidak dikerjakan (fokus lokal).

---

## 4. Fitur yang sudah ada (semua E2E-verified lokal)

**Auth & user** — signup (email verify + captcha anti-replay) → approval admin → login;
forgot/reset password; resend verifikasi; role `developer`/`portal-admin`; rate-limit endpoint
auth; suspend user efektif seketika (cek status DB per-aksi, bukan hanya JWT).

**Katalog (admin)** — CRUD API product; upload/ganti OpenAPI spec; **import dari Kong**
(`/admin/apis/import`, service yang belum di katalog → draft); siklus status
**draft → published → deprecated → retired** (deprecated tampil + tutup subscription baru,
retired hilang dari katalog); route ditampilkan read-only per service.

**Katalog (developer)** — landing page + katalog kartu (`/`); detail API `/apis/[slug]`
(dokumentasi markdown, daftar endpoint dari spec, plans, subscribe, **Try-It console**, riwayat versi).

**Application & credential** — buat app (= consumer), generate API Key/JWT (tampil sekali),
revoke; halaman `/apps` & `/apps/[id]`.

**Subscription** — developer request (app+plan) → antrian approval admin (`/admin/subscriptions`)
→ approve menulis ACL+rate-limit ke Kong (rollback bila gagal) → revoke menghapusnya;
re-subscribe setelah revoked/rejected.

**Consumer management (admin)** — `/admin/consumers`: blacklist/unblock (request-termination),
revoke credential siapa pun, hapus app.

**Try-It console** — `/api/try` proxy server-side (target terkunci ke proxyBaseUrl produk,
bukan open relay); developer menempel API key-nya sendiri.

**Analytics** — pemakaian per app (request per service×status, dari PromQL label consumer).

**Setup/sanity** — `/admin/setup`: cek Kong reachable+versi, plugin tersedia, prometheus
per_consumer (auto-fix), status Prometheus/SMTP/proxy.

**Audit log** — `/admin/audit`: semua aksi teraudit, filter + paginasi.

**Spec versioning** — tiap upload spec baru → snapshot berversi + **diff endpoint otomatis**
(added/removed/changed) + deteksi **breaking** (endpoint dihapus); riwayat di halaman API & admin.

### Peta kode

```
src/lib/kong.ts          semua panggilan Kong Admin API (satu-satunya)
src/lib/metrics.ts       PromQL analytics
src/lib/openapi-diff.ts  diff endpoint antar spec (unit-tested)
src/lib/require-admin.ts requireUser/requireAdmin (cek status+role dari DB)
src/lib/{captcha,rate-limit,tokens,password,mailer,audit,db-errors}.ts
src/actions/*.ts         server actions (admin-products/plans/consumers/setup/users, apps, subscriptions, signup, login, password-reset)
src/app/                 halaman (admin/*, apis/*, apps/*, auth/*, api/try, api/captcha)
src/db/schema.ts         9 tabel; migrasi di drizzle/0000..0003
```

---

## 5. Roadmap (untuk dilanjutkan model/pengembang lain)

Status: **semua fitur dari spec + permintaan tambahan user sudah selesai untuk pakai lokal.**
Yang berikut ditawarkan ke user dan **sengaja ditunda** atau belum dikerjakan.

### Ditunda secara sadar (keputusan user tercatat)
- **Deploy remote / K8s** — Dockerfile siap sebagai artefak, tapi build/push ke registry dan
  manifest K8s (namespace `kai-dev`, nexus) DIBATALKAN user; fokus lokal. Lanjutkan bila mau
  produksi: build image `nexus.msvc.app/kai/kong-kai-devportal:YYYYMMDD.N`, tulis Deployment+
  Service+Ingress, secret dari env di §2.
- **Spec-change lanjutan** (scope dipilih user = "history + auto-diff" saja). Dua lapis berikut
  ditawarkan tapi ditunda:
  - *Deteksi breaking + notifikasi subscriber*: sudah ada `hasBreakingChange()` di
    `openapi-diff.ts` dan badge "breaking"; tinggal tambah banner di `/apis/[slug]` untuk
    subscriber + entri di `/apps/[id]`, opsional email.
  - *Major version = product v2 tertaut* (ala 3scale): alur clone product jadi v2 (slug/ACL/
    service sendiri) + kolom penaut antar-versi, supaya subscriber v1 tetap jalan.

### Backlog teknis (status per Jul 2026)
- ~~Rate-limit & captcha nonce in-memory~~ **SELESAI**: kini Redis-backed bila `REDIS_URL`
  diset (aman multi-replica; dev pakai Dragonfly `redis://:redispassword123@localhost:6479`),
  fallback in-memory otomatis bila kosong/down (`src/lib/redis.ts`, verified: key `rl:*` dan
  `captcha:nonce:*` benar tertulis di Dragonfly, replay & limit ditolak).
- ~~Latency agregat per produk~~ **SELESAI**: `serviceLatencyP95()` di `src/lib/metrics.ts`
  (histogram `kong_request_latency_ms_bucket`, butuh `latency_metrics=true` — auto-fix Setup
  sudah mencakupnya); tampil di halaman detail API. Catatan: seri histogram baru butuh ≥2
  scrape Prometheus sebelum `rate()` menghasilkan nilai (bukan bug).
- ~~Pending-state tombol admin~~ **SELESAI**: `PendingButton` (useFormStatus) dipakai di semua
  form aksi admin.
- **Email-enumeration** di signup (pesan "Email sudah terdaftar"): user **terima risiko** untuk
  portal tertutup ber-approval. Netralkan pesan bila portal jadi lebih terbuka.

### Ide fitur lanjutan (belum di-scope)
- Notifikasi email saat subscription di-approve/reject.
- Render OpenAPI penuh (Scalar/Swagger UI) menggantikan tabel endpoint sederhana.
- Multi-gateway dalam satu portal (kini 1 deployment = 1 Kong via `KONG_ADMIN_URL`).
- Portal membuat/menghapus **route** Kong (perubahan boundary — saat ini route read-only).

---

## 6. Catatan penting untuk kontributor

- **Next.js 16**: konvensi middleware = `src/proxy.ts` (bukan `middleware.ts`); `svg-captcha`
  didaftarkan di `serverExternalPackages`. Baca `AGENTS.md` — versi ini beda dari training data.
- **Error drizzle**: deteksi unique-violation via `isUniqueViolation()` (SQLSTATE bisa di
  `err.code` atau `err.cause.code`), jangan cek `err.code` langsung.
- **Boundary Kong**: jangan tambah kode yang membuat/ubah service/route di `lib/kong.ts` tanpa
  keputusan eksplisit — itu memutus prinsip §1.3.
- Verifikasi perubahan dengan E2E nyata terhadap Kong (panggil proxy sampai 200/401/403/429),
  bukan hanya unit test — pola ini dipakai konsisten selama pengembangan.
