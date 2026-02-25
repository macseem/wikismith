variable "cloudflare_api_token" {
  description = "Cloudflare API token with DNS edit permissions"
  type        = string
  sensitive   = true
}

variable "zone_name" {
  description = "Cloudflare zone (domain) name"
  type        = string
  default     = "dudkin-garage.com"
}

variable "subdomain" {
  description = "Subdomain for WikiSmith"
  type        = string
  default     = "wikismith"
}

variable "vercel_cname_target" {
  description = "Vercel CNAME target for custom domain"
  type        = string
  default     = "cname.vercel-dns.com"
}
