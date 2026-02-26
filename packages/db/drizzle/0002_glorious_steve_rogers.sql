ALTER TABLE "wiki_versions" ADD COLUMN "feature_tree" jsonb;--> statement-breakpoint
ALTER TABLE "wiki_versions" ADD COLUMN "analysis" jsonb;--> statement-breakpoint
WITH ranked_versions AS (
	SELECT
		ctid,
		ROW_NUMBER() OVER (
			PARTITION BY repository_id, commit_sha
			ORDER BY created_at DESC, id DESC
		) AS row_number
	FROM wiki_versions
)
DELETE FROM wiki_versions
USING ranked_versions
WHERE wiki_versions.ctid = ranked_versions.ctid
	AND ranked_versions.row_number > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_versions_repository_commit_unique" ON "wiki_versions" USING btree ("repository_id","commit_sha");
