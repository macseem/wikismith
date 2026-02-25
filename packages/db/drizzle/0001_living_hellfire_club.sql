WITH ranked_repositories AS (
	SELECT
		ctid,
		ROW_NUMBER() OVER (
			PARTITION BY user_id, full_name
			ORDER BY updated_at DESC, created_at DESC, id DESC
		) AS row_number
	FROM repositories
)
DELETE FROM repositories
USING ranked_repositories
WHERE repositories.ctid = ranked_repositories.ctid
	AND ranked_repositories.row_number > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_user_full_name_unique" ON "repositories" USING btree ("user_id","full_name");
