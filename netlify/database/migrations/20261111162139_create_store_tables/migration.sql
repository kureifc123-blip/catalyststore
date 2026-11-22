CREATE TABLE "listings" (
	"id" text PRIMARY KEY,
	"game_id" text NOT NULL,
	"game_name" text NOT NULL,
	"title" text NOT NULL,
	"price" integer NOT NULL,
	"stock" integer DEFAULT 1 NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"specs" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY,
	"type" text NOT NULL,
	"buyer_id" text NOT NULL,
	"buyer_name" text NOT NULL,
	"title" text NOT NULL,
	"game_name" text DEFAULT '' NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL,
	"payment_method" text DEFAULT '' NOT NULL,
	"payment_details" jsonb,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"reserved_listings" jsonb DEFAULT '[]' NOT NULL,
	"stock_restored" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitted_proof" boolean DEFAULT false NOT NULL,
	"proof_image" text DEFAULT '' NOT NULL,
	"cancel_reason" text DEFAULT '' NOT NULL,
	"refund_status" text DEFAULT 'none' NOT NULL,
	"refund_reason" text DEFAULT '' NOT NULL,
	"refund_bank_details" text DEFAULT '' NOT NULL,
	"refund_contact" text DEFAULT '' NOT NULL,
	"refund_evidence_image" text DEFAULT '' NOT NULL,
	"refund_requested_at" timestamp,
	"hidden_for_admin" boolean DEFAULT false NOT NULL,
	"hidden_for_buyer" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"phone" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'customer' NOT NULL,
	"admin_status" text DEFAULT 'approved' NOT NULL,
	"is_root_admin" boolean DEFAULT false NOT NULL,
	"permissions" jsonb DEFAULT '[]' NOT NULL,
	"cart" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "orders_buyer_idx" ON "orders" ("buyer_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" ("status");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" ("user_id");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;