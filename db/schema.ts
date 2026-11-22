import { pgTable, text, integer, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";

// Every registered account (pelanggan, admin, super admin).
export const users = pgTable("users", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  phone: text().notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  role: text().notNull().default("customer"), // customer | admin
  adminStatus: text("admin_status").notNull().default("approved"), // approved | pending_approval | rejected
  isRootAdmin: boolean("is_root_admin").notNull().default(false),
  permissions: jsonb().$type<string[]>().notNull().default([]),
  cart: jsonb().$type<any[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Login sessions (one row per signed-in device).
export const sessions = pgTable(
  "sessions",
  {
    token: text().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull()
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

// Store-wide settings managed by admins (games, joki types, checkpoint & tariff schemes, payments, ...).
export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Game accounts listed in "Toko Akun".
export const listings = pgTable(
  "listings",
  {
  id: text().primaryKey(),
  gameId: text("game_id").notNull(),
  gameName: text("game_name").notNull(),
  title: text().notNull(),
  price: integer().notNull(),
  stock: integer().notNull().default(1),
  image: text().notNull().default(""),
  images: jsonb().$type<string[]>().notNull().default([]),
  description: text().notNull().default(""),
  specs: jsonb().$type<Record<string, string>>().notNull().default({}),
  // Admin who listed this account. NULL = listed by the store (Super Admin / older listings).
  sellerId: text("seller_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
  },
  (t) => [index("listings_seller_idx").on(t.sellerId)]
);

// Orders. Admin and customer each have their own "hidden" flag so deleting
// history on one side never removes it from the other side.
export const orders = pgTable(
  "orders",
  {
    id: text().primaryKey(),
    type: text().notNull(), // JOKI | ACCOUNT | BATCH_CART
    buyerId: text("buyer_id").notNull(),
    buyerName: text("buyer_name").notNull(),
    title: text().notNull(),
    gameName: text("game_name").notNull().default(""),
    detail: text().notNull().default(""),
    price: integer().notNull(),
    whatsapp: text().notNull().default(""),
    paymentMethod: text("payment_method").notNull().default(""),
    paymentDetails: jsonb("payment_details"),
    items: jsonb().$type<any[]>().notNull().default([]),
    reservedListings: jsonb("reserved_listings").$type<string[]>().notNull().default([]),
    stockRestored: boolean("stock_restored").notNull().default(false),
    status: text().notNull().default("pending"), // pending | processing | completed | cancelled
    submittedProof: boolean("submitted_proof").notNull().default(false),
    proofImage: text("proof_image").notNull().default(""),
    cancelReason: text("cancel_reason").notNull().default(""),
    refundStatus: text("refund_status").notNull().default("none"),
    refundReason: text("refund_reason").notNull().default(""),
    refundBankDetails: text("refund_bank_details").notNull().default(""),
    refundContact: text("refund_contact").notNull().default(""),
    refundEvidenceImage: text("refund_evidence_image").notNull().default(""),
    refundRequestedAt: timestamp("refund_requested_at"),
    hiddenForAdmin: boolean("hidden_for_admin").notNull().default(false),
    hiddenForBuyer: boolean("hidden_for_buyer").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (t) => [index("orders_buyer_idx").on(t.buyerId), index("orders_status_idx").on(t.status)]
);
