CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wiki_version_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"current_step" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bucket_date" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"description" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"tracked_branch" text,
	"auto_update" boolean DEFAULT false NOT NULL,
	"webhook_id" text,
	"webhook_secret" text,
	"language" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"github_token_encrypted" text,
	"github_token_iv" text,
	"github_token_tag" text,
	"github_refresh_token_encrypted" text,
	"github_refresh_token_iv" text,
	"github_refresh_token_tag" text,
	"github_token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_workos_id_unique" UNIQUE("workos_id")
);
--> statement-breakpoint
CREATE TABLE "wiki_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wiki_version_id" uuid NOT NULL,
	"feature_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parent_page_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"commit_sha" varchar(40) NOT NULL,
	"branch" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"feature_count" integer DEFAULT 0 NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"generated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_wiki_version_id_wiki_versions_id_fk" FOREIGN KEY ("wiki_version_id") REFERENCES "public"."wiki_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_rate_limits" ADD CONSTRAINT "generation_rate_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_wiki_version_id_wiki_versions_id_fk" FOREIGN KEY ("wiki_version_id") REFERENCES "public"."wiki_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_versions" ADD CONSTRAINT "wiki_versions_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "generation_rate_limits_user_bucket_unique" ON "generation_rate_limits" USING btree ("user_id","bucket_date");