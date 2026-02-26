CREATE TABLE "public_request_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_key" text NOT NULL,
	"route" text NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "public_request_rate_limits_request_route_bucket_unique" ON "public_request_rate_limits" USING btree ("request_key","route","bucket_start");--> statement-breakpoint
