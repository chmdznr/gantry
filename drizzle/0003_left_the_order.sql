CREATE TABLE "api_product_spec_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_product_id" uuid NOT NULL,
	"version" text NOT NULL,
	"spec" jsonb,
	"changelog" jsonb,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_product_spec_versions" ADD CONSTRAINT "api_product_spec_versions_api_product_id_api_products_id_fk" FOREIGN KEY ("api_product_id") REFERENCES "public"."api_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_product_spec_versions" ADD CONSTRAINT "api_product_spec_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;