# AGENTS.md

## Architecture

- **Frontend**: single-page React app built with Vite (`index.html`, `src/main.jsx`, `src/App.jsx`).
  `src/App.jsx` is one large component (ported from the owner's original single-file app) holding
  all screens: auth, Joki calculator, Toko Akun, Riwayat Pesanan, Panel Admin, and modals.
  Tailwind v4 via `@tailwindcss/vite`; styles are utility classes inline.
- **API client**: `src/api.js` — `api()` fetch wrapper, `uploadImage()`, and normalizers that
  shape server rows for the UI (`normalizeOrder`, `normalizeListing`).
- **Backend**: Netlify Server (Hono) at `netlify/server/index.ts`, limited to `/api/*` via
  `[server]` in `netlify.toml`. `netlify/server/defaults.ts` holds default store settings.
- **Shared logic**: `shared/pricing.js` — joki price calculation, permission list, and
  setting→permission map. Used by BOTH the browser and the server; the server always recomputes
  prices from it, never trusting client prices.
- **Data**: Netlify Database via Drizzle (`db/schema.ts`, `db/index.ts`), migrations in
  `netlify/database/migrations/`. Uploaded images go to the Netlify Blobs store `uploads` and are
  served from `/api/files/:key`.

## Key decisions

- **Session token is kept in memory only** (not localStorage/cookies) — the owner explicitly wants
  every page refresh or new device to start at the login screen. Don't "fix" this.
- No guest login. Registration through "Portal Admin" makes the first admin the Super Admin;
  later admins are `pending_approval` until the Super Admin approves them.
- Roles: the Super Admin has every permission. Regular approved admins are **account sellers**
  only (`SELLER_PERMISSIONS = ["listings"]` in the server): they can add/edit/restock/delete
  their OWN listings (`listings.seller_id`), set their seller WhatsApp (`PUT /api/me/whatsapp`,
  stored in `users.phone`), and see read-only `sellerOrders` containing their accounts. Joki,
  orders, payments and all store settings are Super Admin only. The old per-admin
  `users.permissions` toggles are no longer used.
- Every listing shows who sells it (`seller` on `/api/state` listings; NULL seller = the store).
  Order items snapshot `sellerId/sellerName/sellerWhatsapp`; `clientOrder()` exposes `sellers`
  to the buyer and Super Admin. Listings of revoked admins are hidden; deleting an admin deletes
  their listings.
- Store-wide settings (games, models, services = checkpoint & tariff schemes, payments, contact,
  refund rules, account spec fields) live in the `settings` table as JSON per key and apply to
  every account. The UI keeps the old `setX(updater)` style via `updateSetting()` which saves to
  `PUT /api/settings/:key`.
- Customer privacy: `/api/state` returns only the caller's own orders; all-orders data is only
  sent to admins with the `orders` permission; staff/customer lists only to the Super Admin.
- Order deletion is soft and one-sided: `hidden_for_buyer` / `hidden_for_admin`. A row is only
  hard-deleted when both sides have hidden it.
- Listing stock is reserved at order creation and restored once (`stock_restored`) on cancel,
  10-minute expiry (checked lazily on API calls in `expireOrders()`), or approved refund.
- The client polls `/api/state` every 8s; while a write is in flight, settings/cart from polls are
  not applied to avoid overwriting optimistic edits.

## Conventions

- UI copy is Indonesian. Keep the existing dark slate/cyan/indigo visual style.
- Every schema change needs a Drizzle migration (`npx drizzle-kit generate --name ...`).
- Keep API routes in the Hono server; don't add `netlify/functions` endpoints.
