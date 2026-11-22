ALTER TABLE "listings" ADD COLUMN "seller_id" text;--> statement-breakpoint
CREATE INDEX "listings_seller_idx" ON "listings" ("seller_id");--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_users_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE SET NULL;