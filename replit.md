# Lucky Reading Room

A BookMyShow-style monthly seat booking website for Lucky Reading Room — a private study cabin in SR Nagar, Hyderabad. Users can browse 99 cabins, select a month, book a seat, and pay via a demo payment flow. Admins get a password-protected dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/lucky-reading-room run dev` — run the frontend (port 23540)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, wouter (routing), TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/db/src/schema/` — Drizzle schema: `seats.ts`, `bookings.ts`, `pricing.ts`
- `artifacts/api-server/src/routes/` — Express route handlers: `seats.ts`, `bookings.ts`, `payments.ts`, `pricing.ts`, `admin.ts`
- `artifacts/lucky-reading-room/src/pages/` — React pages: `home.tsx`, `book.tsx`, `payment.tsx`, `confirmation.tsx`, `admin-login.tsx`, `admin-dashboard.tsx`
- `artifacts/lucky-reading-room/src/components/` — `seat-selector.tsx`, `hero-carousel.tsx`, `review-card.tsx`, `layout.tsx`
- `lib/api-client-react/src/generated/` — Generated React Query hooks
- `lib/api-zod/src/generated/` — Generated Zod schemas

## Architecture decisions

- Admin authentication uses a simple password ("admin123") stored in localStorage as a token. The API validates `x-admin-token: admin123` on admin endpoints.
- Payment is a demo flow: `POST /api/payments/initiate` creates an in-memory session; `POST /api/payments/confirm` marks the booking as confirmed. No real payment processor.
- Seats are seeded once (99 rows, IDs 1–99). AC section = seats 1–60 (₹2,000/month), Non-AC = 61–99 (₹1,500/month).
- Booking uniqueness enforced at DB query level: a confirmed booking for the same (seatId, month) pair returns 409.
- Pricing is dynamic: admin can update AC/Non-AC prices via the dashboard; seat prices are computed from the pricing table at query time.

## Product

- **Homepage**: photo carousel of the real study hall, Google reviews from actual customers, interactive BookMyShow-style seat grid
- **Seat selector**: 99 clickable cabins grouped into AC (seats 1–60) and Non-AC (seats 61–99) sections, month dropdown (July 2026+), color-coded availability (green/grey)
- **Booking flow**: select seat → fill name/phone/email → demo card payment → confirmation receipt
- **Admin dashboard**: login at `/admin` (password: `admin123`), view monthly stats, manage seat maintenance, update pricing, cancel bookings

## User preferences

- Dark-mode theatre aesthetic (like BookMyShow) with amber/cream accents
- Study hall photos are real (from attached_assets/) — used in the hero carousel
- Google reviews are real — embedded as text cards in the homepage

## Gotchas

- After any OpenAPI spec change, re-run `pnpm --filter @workspace/api-spec run codegen`
- The `x-admin-token` header is required for seat PATCH and pricing PATCH routes — the frontend sends `"admin123"` as the token
- Payment sessions are in-memory (Map), so they reset on server restart — users mid-payment will need to re-initiate

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
