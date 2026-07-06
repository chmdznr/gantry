ALTER TYPE "public"."product_status" ADD VALUE 'retired';--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "blocked_at" timestamp;