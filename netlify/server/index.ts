import { Hono } from "hono";
import type { Context } from "hono";
import { randomBytes, randomUUID, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, lt, ne, sql } from "drizzle-orm";
import { getStore } from "@netlify/blobs";
import { db } from "../../db/index.js";
import { users, sessions, settings, listings, orders } from "../../db/schema.js";
import { DEFAULT_SETTINGS } from "./defaults.js";
import { calcJokiPrice, jokiDetail, ADMIN_PERMISSIONS, SETTING_PERMISSION } from "../../shared/pricing.js";

type User = typeof users.$inferSelect;
type Order = typeof orders.$inferSelect;
type Env = { Variables: { user: User } };

const app = new Hono<Env>();

const SESSION_HOURS = 12;
const STORE_SELLER_NAME = "CATALYST STORE (Resmi)";
const PAYMENT_WINDOW_MS = 10 * 60 * 1000;
const PERMISSION_IDS = ADMIN_PERMISSIONS.map((p) => p.id);

// ---------- helpers ----------
const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, stored: string) => {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
};

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
const orderNumber = (prefix: string) => `${prefix}-${randomInt(100000, 999999)}`;

const isApprovedAdmin = (u?: User | null) => Boolean(u && u.role === "admin" && u.adminStatus === "approved");
// Regular (non-root) admins are account sellers: they can only manage their OWN
// "Jual Akun" listings. Everything else (joki, orders, payments, ...) is Super Admin only.
const SELLER_PERMISSIONS = ["listings"];
const hasPerm = (u: User | null | undefined, perm: string) =>
  isApprovedAdmin(u) && (u!.isRootAdmin || SELLER_PERMISSIONS.includes(perm));

const publicUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  adminStatus: u.adminStatus,
  isRootAdmin: u.isRootAdmin,
  permissions: isApprovedAdmin(u) ? (u.isRootAdmin ? PERMISSION_IDS : SELLER_PERMISSIONS) : [],
  registeredAt: u.createdAt
});

const fail = (c: Context, status: number, error: string) => c.json({ error }, status as any);

const readJson = async (c: Context) => {
  try {
    return (await c.req.json()) || {};
  } catch {
    return {};
  }
};

const getAllSettings = async () => {
  const rows = await db.select().from(settings);
  const out: Record<string, any> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
};

const saveSetting = async (key: string, value: any) => {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
};

// Put reserved stock back (only once per order).
const restoreStock = async (orderId: string) => {
  const [o] = await db
    .update(orders)
    .set({ stockRestored: true })
    .where(and(eq(orders.id, orderId), eq(orders.stockRestored, false)))
    .returning();
  if (!o) return;
  for (const listingId of o.reservedListings || []) {
    await db
      .update(listings)
      .set({ stock: sql`${listings.stock} + 1` })
      .where(eq(listings.id, listingId));
  }
};

// Auto-cancel unpaid orders after 10 minutes without a proof of payment.
const expireOrders = async () => {
  const expired = await db
    .update(orders)
    .set({ status: "cancelled", cancelReason: "Batas waktu pembayaran 10 menit telah habis" })
    .where(
      and(
        eq(orders.status, "pending"),
        eq(orders.submittedProof, false),
        lt(orders.createdAt, new Date(Date.now() - PAYMENT_WINDOW_MS))
      )
    )
    .returning({ id: orders.id });
  for (const o of expired) await restoreStock(o.id);
};

// Soft-delete for one side; the row is only removed once both sides deleted it.
const purgeIfHiddenEverywhere = async (orderId: string) => {
  await db
    .delete(orders)
    .where(and(eq(orders.id, orderId), eq(orders.hiddenForAdmin, true), eq(orders.hiddenForBuyer, true)));
};

// Build a trusted order item from what the browser sent (prices always recomputed here).
const resolveItem = (item: any, cfg: Record<string, any>, listingMap: Map<string, any>) => {
  if (!item || typeof item !== "object") return null;
  if (item.type === "JOKI") {
    const srv = (cfg.services || []).find((s: any) => s.id === item.serviceId);
    if (!srv) return null;
    const opts = { fromLevel: item.fromLevel, toLevel: item.toLevel, qty: item.qty };
    const price = calcJokiPrice(srv, opts);
    if (price <= 0) return null;
    return {
      cartId: String(item.cartId || newId("crt")),
      type: "JOKI",
      serviceId: srv.id,
      fromLevel: item.fromLevel || "",
      toLevel: item.toLevel || "",
      qty: srv.pricingType === "multiplier" ? Math.max(1, Math.floor(Number(item.qty) || 1)) : 1,
      title: `${srv.gameName} - ${srv.modelName}`,
      gameName: srv.gameName,
      detail: jokiDetail(srv, opts),
      price
    };
  }
  if (item.type === "ACCOUNT") {
    const acc = listingMap.get(item.accountId);
    if (!acc) return null;
    return {
      cartId: String(item.cartId || newId("crt")),
      type: "ACCOUNT",
      accountId: acc.id,
      title: `Beli Akun: ${acc.title}`,
      gameName: acc.gameName,
      detail: specsSummary(acc, cfg),
      price: acc.price,
      sellerId: acc.seller?.id || null,
      sellerName: acc.seller?.name || STORE_SELLER_NAME,
      sellerWhatsapp: acc.seller?.whatsapp || ""
    };
  }
  return null;
};

const specsSummary = (acc: any, cfg: Record<string, any>) =>
  Object.entries(acc.specs || {})
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => {
      const f = (cfg.accountFields || []).find((x: any) => x.id === k);
      return `${f ? f.label : k}: ${v}`;
    })
    .join(" | ") || "Spesifikasi terverifikasi";

// Listings visible in the shop, with who is selling them. Listings of admins whose
// access was revoked are hidden; listings without a seller belong to the store itself.
const visibleListings = async () => {
  const rows = await db
    .select({ listing: listings, seller: { id: users.id, name: users.name, phone: users.phone, role: users.role, adminStatus: users.adminStatus, isRootAdmin: users.isRootAdmin } })
    .from(listings)
    .leftJoin(users, eq(listings.sellerId, users.id))
    .orderBy(desc(listings.createdAt));
  return rows
    .filter((r) => !r.listing.sellerId || (r.seller && r.seller.role === "admin" && r.seller.adminStatus === "approved"))
    .map((r) => ({
      ...r.listing,
      seller: r.seller
        ? { id: r.seller.id, name: r.seller.name, whatsapp: r.seller.phone, isRootAdmin: r.seller.isRootAdmin }
        : null
    }));
};

const listingMapAll = async () => {
  const rows = await visibleListings();
  return new Map(rows.map((r) => [r.id, r]));
};

// Reserve one unit of stock per account in the order; undo everything if any is sold out.
const reserveStock = async (ids: string[]) => {
  const reserved: string[] = [];
  for (const id of ids) {
    const [row] = await db
      .update(listings)
      .set({ stock: sql`${listings.stock} - 1` })
      .where(and(eq(listings.id, id), gt(listings.stock, 0)))
      .returning({ id: listings.id });
    if (!row) {
      for (const r of reserved) {
        await db.update(listings).set({ stock: sql`${listings.stock} + 1` }).where(eq(listings.id, r));
      }
      return null;
    }
    reserved.push(id);
  }
  return reserved;
};

const sanitizeListing = (body: any, cfg: Record<string, any>) => {
  const game = (cfg.games || []).find((g: any) => g.id === body.gameId);
  const title = String(body.title || "").trim();
  const price = Math.floor(Number(body.price) || 0);
  if (!game || !title || price <= 0) return null;
  const specs: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.specs || {})) {
    if (v !== undefined && v !== null && String(v).trim() !== "") specs[k] = String(v).trim();
  }
  const images = [...new Set<string>((Array.isArray(body.images) ? body.images : [body.image])
    .filter((url: unknown): url is string => typeof url === "string")
    .map((url: string) => url.trim()).filter((url: string) => /^\/api\/files\/[^\s]+$/.test(url) || /^https?:\/\/[^\s]+$/.test(url)))].slice(0, 10);
  return {
    gameId: game.id,
    gameName: game.name,
    title,
    price,
    stock: Math.max(0, Math.floor(Number(body.stock ?? 1) || 0)),
    images,
    image: images[0] || "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop",
    description: String(body.description || "").trim().slice(0, 5000) || "Akun game terverifikasi & aman.",
    specs
  };
};

// ---------- auth middleware ----------
const requireAuth = async (c: Context<Env>, next: () => Promise<void>) => {
  const header = c.req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return fail(c, 401, "Silakan masuk ke akun Anda terlebih dahulu.");
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())));
  if (!row) return fail(c, 401, "Sesi berakhir. Silakan masuk kembali.");
  const u = row.user;
  if (u.role === "admin" && u.adminStatus !== "approved") return fail(c, 403, "Akses admin Anda belum aktif.");
  c.set("user", u);
  await next();
};

const requirePerm = (perm: string) => async (c: Context<Env>, next: () => Promise<void>) => {
  if (!hasPerm(c.get("user"), perm)) return fail(c, 403, "Anda belum diberi izin oleh Super Admin untuk fitur ini.");
  await next();
};

const requireRoot = async (c: Context<Env>, next: () => Promise<void>) => {
  const u = c.get("user");
  if (!isApprovedAdmin(u) || !u.isRootAdmin) return fail(c, 403, "Khusus Super Admin.");
  await next();
};

const createSession = async (userId: string) => {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({
    token,
    userId,
    expiresAt: new Date(Date.now() + SESSION_HOURS * 3600 * 1000)
  });
  return token;
};

// ---------- public routes ----------
app.get("/api/auth/setup", async (c) => {
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  return c.json({ hasAdmin: Boolean(admin) });
});

app.post("/api/auth/register", async (c) => {
  const body = await readJson(c);
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const portal = body.portal === "admin" ? "admin" : "customer";

  if (!name || !phone || !email || password.length < 8 || !/^\S+@\S+\.\S+$/.test(email)) {
    return fail(c, 400, "Semua form wajib diisi dengan benar. Sandi minimal 8 digit.");
  }
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) return fail(c, 409, "Email ini telah digunakan. Gunakan email lain.");

  let role = "customer";
  let adminStatus = "approved";
  let isRootAdmin = false;
  if (portal === "admin") {
    const [anyAdmin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
    role = "admin";
    isRootAdmin = !anyAdmin;
    adminStatus = isRootAdmin ? "approved" : "pending_approval";
  }

  const [u] = await db
    .insert(users)
    .values({ id: newId("usr"), name, email, phone, passwordHash: hashPassword(password), role, adminStatus, isRootAdmin })
    .returning();

  if (role === "admin" && adminStatus === "pending_approval") {
    return c.json({ pending: true });
  }
  const token = await createSession(u.id);
  return c.json({ token, user: publicUser(u) });
});

app.post("/api/auth/login", async (c) => {
  const body = await readJson(c);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const portal = body.portal === "admin" ? "admin" : "customer";

  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (!u || !verifyPassword(password, u.passwordHash)) return fail(c, 401, "Email atau Kata Sandi salah.");

  if (portal === "admin" && u.role !== "admin") return fail(c, 403, "Akun ini bukan akun Admin.");
  if (u.role === "admin" && u.adminStatus === "pending_approval")
    return fail(c, 403, "Akun Admin Anda masih menunggu persetujuan dari Super Admin.");
  if (u.role === "admin" && u.adminStatus === "rejected")
    return fail(c, 403, "Permohonan akun Admin Anda telah ditolak oleh Super Admin.");

  // housekeeping: drop expired sessions of this user
  await db.delete(sessions).where(and(eq(sessions.userId, u.id), lt(sessions.expiresAt, new Date())));
  const token = await createSession(u.id);
  return c.json({ token, user: publicUser(u) });
});

// Uploaded images (payment proofs, account screenshots, QR codes) — keys are random and unguessable.
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif"
};

app.get("/api/files/:key", async (c) => {
  const key = c.req.param("key");
  if (!/^[a-f0-9-]+\.(png|jpe?g|webp|gif|avif)$/.test(key)) return c.notFound();
  const data = await getStore("uploads").get(key, { type: "arrayBuffer" });
  if (!data) return c.notFound();
  const ext = key.split(".").pop()!;
  return new Response(data, {
    headers: {
      "content-type": MIME_BY_EXT[ext] || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable"
    }
  });
});

// ---------- authenticated routes ----------
const PUBLIC_PATHS = ["/api/auth/", "/api/files/"];
app.use("/api/*", async (c, next) => {
  if (PUBLIC_PATHS.some((p) => c.req.path.startsWith(p))) return next();
  return requireAuth(c, next);
});

app.post("/api/me/logout", async (c) => {
  const token = (c.req.header("authorization") || "").slice(7);
  await db.delete(sessions).where(eq(sessions.token, token));
  return c.json({ ok: true });
});

// Everything the signed-in account is allowed to see, in one request.
app.get("/api/state", async (c) => {
  const u = c.get("user");
  await expireOrders();
  const [cfg, listingRows, myOrders] = await Promise.all([
    getAllSettings(),
    visibleListings(),
    db
      .select()
      .from(orders)
      .where(and(eq(orders.buyerId, u.id), eq(orders.hiddenForBuyer, false)))
      .orderBy(desc(orders.createdAt))
  ]);

  const out: Record<string, any> = {
    user: publicUser(u),
    settings: cfg,
    listings: listingRows,
    orders: myOrders.map(clientOrder),
    cart: u.cart || []
  };

  if (hasPerm(u, "orders")) {
    const all = await db.select().from(orders).where(eq(orders.hiddenForAdmin, false)).orderBy(desc(orders.createdAt));
    out.adminOrders = all.map(clientOrder);
  }
  // Regular admins (sellers) see orders that contain THEIR accounts only — read-only.
  if (isApprovedAdmin(u) && !u.isRootAdmin) {
    const mine = await db
      .select()
      .from(orders)
      .where(sql`${orders.items} @> ${JSON.stringify([{ sellerId: u.id }])}::jsonb`)
      .orderBy(desc(orders.createdAt))
      .limit(200);
    out.sellerOrders = mine.map((o) => {
      const myItems = (o.items || []).filter((i: any) => i.sellerId === u.id);
      const paid = o.status === "processing" || o.status === "completed";
      return {
        id: o.id,
        createdAt: o.createdAt,
        status: o.status,
        refundStatus: o.refundStatus,
        buyerName: o.buyerName,
        buyerWhatsapp: paid ? o.whatsapp : "",
        items: myItems.map((i: any) => ({ title: i.title, gameName: i.gameName, price: i.price })),
        total: myItems.reduce((s: number, i: any) => s + (Number(i.price) || 0), 0)
      };
    });
  }
  if (isApprovedAdmin(u) && u.isRootAdmin) {
    const everyone = await db.select().from(users).where(ne(users.id, u.id)).orderBy(desc(users.createdAt));
    out.staff = everyone.filter((x) => x.role === "admin").map(publicUser);
    out.customers = everyone.filter((x) => x.role !== "admin").map(publicUser);
  }
  return c.json(out);
});

const clientOrder = (o: Order) => {
  const { reservedListings, stockRestored, hiddenForAdmin, hiddenForBuyer, items, ...rest } = o;
  // Who sold the accounts in this order (shown to the buyer and the Super Admin).
  const sellers: { id: string | null; name: string; whatsapp: string }[] = [];
  for (const i of items || []) {
    if (i?.type !== "ACCOUNT") continue;
    const key = i.sellerId || null;
    if (sellers.some((s) => s.id === key)) continue;
    sellers.push({ id: key, name: i.sellerName || STORE_SELLER_NAME, whatsapp: i.sellerWhatsapp || "" });
  }
  return { ...rest, cartItemsList: items, sellers };
};

// Cart is stored per account, so it follows the customer to any device.
app.put("/api/cart", async (c) => {
  const u = c.get("user");
  const body = await readJson(c);
  const cfg = await getAllSettings();
  const map = await listingMapAll();
  const items = (Array.isArray(body.items) ? body.items : [])
    .slice(0, 30)
    .map((it: any) => resolveItem(it, cfg, map))
    .filter(Boolean);
  await db.update(users).set({ cart: items }).where(eq(users.id, u.id));
  return c.json({ cart: items });
});

app.post("/api/upload", async (c) => {
  const body = await readJson(c);
  const match = /^data:image\/(png|jpe?g|webp|gif|avif);base64,(.+)$/.exec(String(body.dataUrl || ""));
  if (!match) return fail(c, 400, "Format gambar tidak didukung.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 5 * 1024 * 1024) return fail(c, 413, "Ukuran gambar maksimal 5 MB.");
  const key = `${randomUUID()}.${match[1] === "jpeg" ? "jpg" : match[1]}`;
  await getStore("uploads").set(key, new Uint8Array(bytes).buffer);
  return c.json({ url: `/api/files/${key}` });
});

// ---------- orders (customer side) ----------
const findActiveOrder = async (userId: string) => {
  const [o] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.buyerId, userId), sql`${orders.status} in ('pending','processing')`))
    .limit(1);
  return o;
};

app.post("/api/orders", async (c) => {
  const u = c.get("user");
  const body = await readJson(c);
  await expireOrders();

  if (u.role !== "admin" && (await findActiveOrder(u.id))) {
    return fail(c, 409, "Selesaikan pesanan aktif Anda terlebih dahulu.");
  }

  const cfg = await getAllSettings();
  const map = await listingMapAll();
  const payments = cfg.payments || [];
  let type = "";
  let items: any[] = [];
  let pay: any = null;
  let whatsapp = String(body.whatsapp || "").trim();
  let prefix = "ORD";

  if (body.kind === "JOKI") {
    const item = resolveItem({ ...body, type: "JOKI" }, cfg, map);
    if (!item) return fail(c, 400, "Pilihan tingkatan joki belum valid.");
    type = "JOKI";
    items = [item];
    pay = payments.find((p: any) => p.id === body.paymentMethodId);
    if (!pay || !whatsapp) return fail(c, 400, "Lengkapi metode pembayaran dan WhatsApp.");
  } else if (body.kind === "ACCOUNT") {
    const item = resolveItem({ type: "ACCOUNT", accountId: body.accountId }, cfg, map);
    if (!item) return fail(c, 404, "Akun tidak ditemukan.");
    type = "ACCOUNT";
    prefix = "ACC";
    items = [item];
    pay = payments[0] || null;
    whatsapp = whatsapp || u.phone || "08xxxxxxxxxx";
  } else if (body.kind === "CART") {
    items = (u.cart || []).map((it: any) => resolveItem(it, cfg, map)).filter(Boolean);
    if (!items.length) return fail(c, 400, "Keranjang belanja kosong!");
    type = "BATCH_CART";
    prefix = "CART";
    pay = payments.find((p: any) => p.id === body.paymentMethodId);
    if (!pay) return fail(c, 400, "Pilih metode pembayaran bersama!");
    if (!whatsapp) return fail(c, 400, "Masukkan nomor WhatsApp aktif!");
  } else {
    return fail(c, 400, "Jenis pesanan tidak dikenal.");
  }

  const accountIds = items.filter((i) => i.type === "ACCOUNT").map((i) => i.accountId);
  const reserved = await reserveStock(accountIds);
  if (reserved === null) return fail(c, 409, "Maaf, stok akun yang dipilih sudah habis.");

  const total = items.reduce((s, i) => s + (Number(i.price) || 0), 0);
  const first = items[0];
  const [created] = await db
    .insert(orders)
    .values({
      id: orderNumber(prefix),
      type,
      buyerId: u.id,
      buyerName: u.name,
      title:
        type === "BATCH_CART"
          ? `Checkout Barengan (${items.length} Item)`
          : type === "ACCOUNT"
          ? `${first.title} (${first.gameName})`
          : first.title,
      gameName: type === "BATCH_CART" ? "Multi-Item" : first.gameName,
      detail: type === "BATCH_CART" ? items.map((i) => `${i.title} (${i.detail})`).join(", ") : first.detail,
      price: total,
      whatsapp,
      paymentMethod: pay ? pay.name : "Transfer Bank / QRIS",
      paymentDetails: pay,
      items,
      reservedListings: reserved
    })
    .returning();

  if (type === "BATCH_CART") await db.update(users).set({ cart: [] }).where(eq(users.id, u.id));
  return c.json({ order: clientOrder(created) });
});

const loadOwnOrder = async (c: Context<Env>) => {
  const [o] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, c.req.param("id")!), eq(orders.buyerId, c.get("user").id)));
  return o;
};

app.post("/api/orders/:id/proof", async (c) => {
  const o = await loadOwnOrder(c);
  if (!o) return fail(c, 404, "Pesanan tidak ditemukan.");
  const { proofImage } = await readJson(c);
  if (!proofImage || !String(proofImage).startsWith("/api/files/")) return fail(c, 400, "Unggah struk transfer terlebih dahulu!");
  if (o.status !== "pending" || o.submittedProof) return fail(c, 409, "Bukti pembayaran sudah dikunci atau pesanan tidak aktif.");
  const [upd] = await db
    .update(orders)
    .set({ submittedProof: true, proofImage: String(proofImage) })
    .where(eq(orders.id, o.id))
    .returning();
  return c.json({ order: clientOrder(upd) });
});

app.post("/api/orders/:id/cancel", async (c) => {
  const o = await loadOwnOrder(c);
  if (!o) return fail(c, 404, "Pesanan tidak ditemukan.");
  if (o.status !== "pending") return fail(c, 409, "Hanya pesanan yang menunggu pembayaran yang bisa dibatalkan.");
  const [upd] = await db
    .update(orders)
    .set({ status: "cancelled", cancelReason: "Dibatalkan oleh pelanggan" })
    .where(eq(orders.id, o.id))
    .returning();
  await restoreStock(o.id);
  return c.json({ order: clientOrder(upd) });
});

app.post("/api/orders/:id/refund", async (c) => {
  const o = await loadOwnOrder(c);
  if (!o) return fail(c, 404, "Pesanan tidak ditemukan.");
  const eligible =
    (o.status === "processing" || o.status === "completed" || (o.status === "pending" && o.submittedProof)) &&
    o.refundStatus !== "requested" &&
    o.refundStatus !== "approved";
  if (!eligible) return fail(c, 409, "Pesanan ini tidak bisa diajukan refund.");

  const b = await readJson(c);
  const cfg = (await getAllSettings()).refund || {};
  const v = (k: string) => String(b[k] || "").trim();
  if (cfg.requireReason && !v("reason")) return fail(c, 400, "Alasan refund wajib diisi!");
  if (cfg.requireBankName && !v("bankName")) return fail(c, 400, "Nama Bank / E-Wallet wajib diisi!");
  if (cfg.requireAccountNumber && !v("accountNumber")) return fail(c, 400, "Nomor rekening wajib diisi!");
  if (cfg.requireAccountHolder && !v("accountHolder")) return fail(c, 400, "Nama pemilik rekening wajib diisi!");
  if (cfg.requireEvidenceImage && !v("evidenceImage")) return fail(c, 400, "Foto bukti kendala wajib diunggah!");

  const [upd] = await db
    .update(orders)
    .set({
      refundStatus: "requested",
      refundReason: v("reason"),
      refundBankDetails: `${v("bankName")} - ${v("accountNumber")} (a.n ${v("accountHolder")})`,
      refundContact: v("alternativeContact"),
      refundEvidenceImage: v("evidenceImage").startsWith("/api/files/") ? v("evidenceImage") : "",
      refundRequestedAt: new Date()
    })
    .where(eq(orders.id, o.id))
    .returning();
  return c.json({ order: clientOrder(upd) });
});

// Customer removes an order from THEIR history only.
app.delete("/api/orders/:id", async (c) => {
  const o = await loadOwnOrder(c);
  if (!o) return fail(c, 404, "Pesanan tidak ditemukan.");
  if (o.status === "pending" || o.status === "processing")
    return fail(c, 409, "Pesanan yang masih aktif tidak bisa dihapus. Batalkan atau tunggu hingga selesai.");
  await db.update(orders).set({ hiddenForBuyer: true }).where(eq(orders.id, o.id));
  await purgeIfHiddenEverywhere(o.id);
  return c.json({ ok: true });
});

// ---------- settings ----------
app.put("/api/settings/:key", async (c) => {
  const key = c.req.param("key");
  const perm = (SETTING_PERMISSION as Record<string, string>)[key];
  if (!perm) return fail(c, 404, "Pengaturan tidak dikenal.");
  const me = c.get("user");
  if (!isApprovedAdmin(me) || !me.isRootAdmin) return fail(c, 403, "Pengaturan toko hanya bisa diubah oleh Super Admin.");
  const { value } = await readJson(c);
  const isList = Array.isArray(DEFAULT_SETTINGS[key]);
  if (isList ? !Array.isArray(value) : !value || typeof value !== "object" || Array.isArray(value)) {
    return fail(c, 400, "Format pengaturan tidak valid.");
  }
  await saveSetting(key, value);
  return c.json({ ok: true, value });
});

// ---------- listings (Jual Akun) ----------
// Super Admin may touch every listing; a regular admin only the listings they created.
const ownListing = (c: Context<Env>) => {
  const u = c.get("user");
  const byId = eq(listings.id, c.req.param("id")!);
  return u.isRootAdmin ? byId : and(byId, eq(listings.sellerId, u.id));
};

app.post("/api/listings", requirePerm("listings"), async (c) => {
  const u = c.get("user");
  const data = sanitizeListing(await readJson(c), await getAllSettings());
  if (!data) return fail(c, 400, "Lengkapi nama game, judul akun, dan harga!");
  if (!u.isRootAdmin && !String(u.phone || "").replace(/[^0-9]/g, "")) {
    return fail(c, 400, "Isi Nomor WhatsApp Penjual Anda terlebih dahulu.");
  }
  const [row] = await db.insert(listings).values({ id: newId("acc"), ...data, sellerId: u.id }).returning();
  return c.json({ listing: row });
});

app.put("/api/listings/:id", requirePerm("listings"), async (c) => {
  const data = sanitizeListing(await readJson(c), await getAllSettings());
  if (!data) return fail(c, 400, "Lengkapi nama game, judul akun, dan harga!");
  const [row] = await db
    .update(listings)
    .set({ ...data, updatedAt: new Date() })
    .where(ownListing(c))
    .returning();
  if (!row) return fail(c, 404, "Akun tidak ditemukan atau bukan milik Anda.");
  return c.json({ listing: row });
});

app.patch("/api/listings/:id/stock", requirePerm("listings"), async (c) => {
  const { stock } = await readJson(c);
  const [row] = await db
    .update(listings)
    .set({ stock: Math.max(0, Math.floor(Number(stock) || 0)), updatedAt: new Date() })
    .where(ownListing(c))
    .returning();
  if (!row) return fail(c, 404, "Akun tidak ditemukan atau bukan milik Anda.");
  return c.json({ listing: row });
});

app.delete("/api/listings/:id", requirePerm("listings"), async (c) => {
  const [row] = await db.delete(listings).where(ownListing(c)).returning({ id: listings.id });
  if (!row) return fail(c, 404, "Akun tidak ditemukan atau bukan milik Anda.");
  return c.json({ ok: true });
});

// Admin's own WhatsApp number — shown to buyers on every account they sell.
app.put("/api/me/whatsapp", async (c) => {
  const u = c.get("user");
  if (!isApprovedAdmin(u)) return fail(c, 403, "Khusus admin.");
  const { whatsapp } = await readJson(c);
  const value = String(whatsapp || "").trim();
  if (value.replace(/[^0-9]/g, "").length < 8 || value.length > 30) return fail(c, 400, "Nomor WhatsApp tidak valid.");
  const [upd] = await db.update(users).set({ phone: value }).where(eq(users.id, u.id)).returning();
  return c.json({ user: publicUser(upd) });
});

// ---------- admin: orders ----------
app.post("/api/admin/orders/:id/status", requirePerm("orders"), async (c) => {
  const { status } = await readJson(c);
  if (!["processing", "completed", "cancelled"].includes(status)) return fail(c, 400, "Status tidak valid.");
  const [upd] = await db
    .update(orders)
    .set(status === "cancelled" ? { status, cancelReason: "Dibatalkan oleh admin" } : { status })
    .where(eq(orders.id, c.req.param("id")))
    .returning();
  if (!upd) return fail(c, 404, "Pesanan tidak ditemukan.");
  if (status === "cancelled") await restoreStock(upd.id);
  return c.json({ order: clientOrder(upd) });
});

app.post("/api/admin/orders/:id/refund", requirePerm("orders"), async (c) => {
  const { status } = await readJson(c);
  if (!["approved", "rejected"].includes(status)) return fail(c, 400, "Status refund tidak valid.");
  const [upd] = await db
    .update(orders)
    .set(status === "approved" ? { refundStatus: status, status: "cancelled", cancelReason: "Dana dikembalikan (refund)" } : { refundStatus: status })
    .where(and(eq(orders.id, c.req.param("id")), eq(orders.refundStatus, "requested")))
    .returning();
  if (!upd) return fail(c, 404, "Pengajuan refund tidak ditemukan.");
  if (status === "approved") await restoreStock(upd.id);
  return c.json({ order: clientOrder(upd) });
});

// Admin removes an order from the ADMIN list only — the customer's history keeps it.
app.delete("/api/admin/orders/:id", requirePerm("orders"), async (c) => {
  const id = c.req.param("id");
  await db.update(orders).set({ hiddenForAdmin: true }).where(eq(orders.id, id));
  await purgeIfHiddenEverywhere(id);
  return c.json({ ok: true });
});

// ---------- super admin: staff & customers ----------
app.post("/api/admin/users/:id", requireRoot, async (c) => {
  const id = c.req.param("id");
  const body = await readJson(c);
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target || target.isRootAdmin) return fail(c, 404, "Akun tidak ditemukan.");
  const patch: Partial<User> = {};
  if (["approved", "rejected", "pending_approval"].includes(body.adminStatus) && target.role === "admin") {
    patch.adminStatus = body.adminStatus;
  }
  if (Array.isArray(body.permissions)) {
    patch.permissions = body.permissions.filter((p: string) => PERMISSION_IDS.includes(p));
  }
  if (!Object.keys(patch).length) return fail(c, 400, "Tidak ada perubahan.");
  const [upd] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  if (patch.adminStatus && patch.adminStatus !== "approved") {
    await db.delete(sessions).where(eq(sessions.userId, id));
  }
  return c.json({ user: publicUser(upd) });
});

app.delete("/api/admin/users/:id", requireRoot, async (c) => {
  const id = c.req.param("id");
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target || target.isRootAdmin) return fail(c, 404, "Akun tidak ditemukan.");
  // An admin's listings leave the shop together with the admin.
  await db.delete(listings).where(eq(listings.sellerId, id));
  await db.delete(users).where(eq(users.id, id));
  return c.json({ ok: true });
});

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Terjadi kesalahan pada server. Coba lagi." }, 500);
});

export default app;
