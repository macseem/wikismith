resource "cloudflare_dns_record" "wikismith" {
  zone_id = data.cloudflare_zone.this.id
  name    = var.subdomain
  type    = "CNAME"
  content = var.vercel_cname_target
  proxied = false
  ttl     = 300
  comment = "WikiSmith - Vercel deployment"
}
