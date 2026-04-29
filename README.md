# FaceGate OS — Slice 1

Luxury, dark-first facial re-entry administration console built on Next.js 14, Prisma, PostgreSQL (Neon), and next-auth v5 (credentials).

## Prerequisites

- Node.js 20+
- PostgreSQL (this project is wired for Neon via `.env.local`)

## Run instructions

```bash
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

Prisma CLI reads `.env` by default. If your connection strings live only in `.env.local`, use:

```bash
npx dotenv -e .env.local -- npx prisma db push
npx dotenv -e .env.local -- npx prisma db seed
```

Or run `npm run db:push`, which loads `.env.local` and performs push plus seed.

## Login

- **Email:** `admin@maisondoclar.com`
- **Password:** `FaceGate2026!`

## Kiosk heartbeat

`POST /api/kiosk/heartbeat` with header:

`Authorization: Basic base64(devicePublicId:deviceSecretPlaintext)`

Returns JSON `{ data: { eventStatus, gateActive }, error: null }` on success.

### Gate kiosk

- Full-screen kiosk: `/kiosk/[devicePublicId]` (use the device’s **devicePublicId** from the admin gate/device list).
- After seeding, a demo tablet URL is `/kiosk/seed-kiosk-main` with access code printed by `prisma/seed.ts` (`FaceGateKiosk2026!`). Secrets are only entered once per browser tab and stored in `sessionStorage`.
- Staff diagnostic checklist: `/kiosk/[devicePublicId]/diagnostic`.

To simulate several gates at once, open `/kiosk/[devicePublicId]` in separate browser tabs with **different** device tokens — each gate device authenticates on its own and attempts are scoped per gate.

## Security

Rotate database credentials, AWS keys, and `NEXTAUTH_SECRET` before production. `.env.local` is gitignored — never commit secrets.
