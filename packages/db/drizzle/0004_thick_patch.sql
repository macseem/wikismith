CREATE TABLE "wiki_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"share_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"embed_enabled" boolean DEFAULT false NOT NULL,
	"token_rotated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wiki_shares" ADD CONSTRAINT "wiki_shares_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_shares_repository_unique" ON "wiki_shares" USING btree ("repository_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_shares_share_token_unique" ON "wiki_shares" USING btree ("share_token");