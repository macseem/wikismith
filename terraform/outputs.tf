output "zone_id" {
  description = "Cloudflare zone ID"
  value       = data.cloudflare_zone.this.id
}

output "fqdn" {
  description = "Full domain name for WikiSmith"
  value       = "${var.subdomain}.${var.zone_name}"
}

output "dns_record_id" {
  description = "Cloudflare DNS record ID"
  value       = cloudflare_dns_record.wikismith.id
}
