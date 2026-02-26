CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "wiki_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"wiki_version_id" uuid NOT NULL,
	"wiki_page_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"section_heading" text NOT NULL,
	"chunk_text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wiki_embeddings" ADD CONSTRAINT "wiki_embeddings_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_embeddings" ADD CONSTRAINT "wiki_embeddings_wiki_version_id_wiki_versions_id_fk" FOREIGN KEY ("wiki_version_id") REFERENCES "public"."wiki_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_embeddings" ADD CONSTRAINT "wiki_embeddings_wiki_page_id_wiki_pages_id_fk" FOREIGN KEY ("wiki_page_id") REFERENCES "public"."wiki_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wiki_embeddings_wiki_version_idx" ON "wiki_embeddings" USING btree ("wiki_version_id");--> statement-breakpoint
CREATE INDEX "wiki_embeddings_wiki_page_idx" ON "wiki_embeddings" USING btree ("wiki_page_id");--> statement-breakpoint
CREATE INDEX "wiki_embeddings_embedding_hnsw_idx" ON "wiki_embeddings" USING hnsw ("embedding" vector_cosine_ops);
