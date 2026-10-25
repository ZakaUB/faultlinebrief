# Faultline Brief — Facebook automation

This directory is an **isolated development area**. It does not change the Next.js/Payload website, database, website routes, or existing Cloudflare deployment.

## Proposed architecture

A dedicated Cloudflare Worker (separate name, account bindings, deployment and cron triggers) will:
1. Collect candidate stories from approved news sources.
2. Require independently corroborated facts before publication; attribute disputed claims.
3. Generate an original editorial graphic clearly labeled as illustrative when synthetic.
4. Upload the graphic to a **separate R2 bucket** with a publicly accessible image URL.
5. Schedule a Facebook Page post through Metricool with the image URL and a factual caption.
6. Record a stable story fingerprint to prevent duplicate publication.

## Safety gates

- Never publish to a personal Facebook profile, advertise, or boost.
- Never publish an unverified breaking-news assertion.
- Never modify Payload collections, Neon/D1 data, the website's R2 bucket, or website CI/CD.
- Require an explicit `PUBLISHING_ENABLED=true` setting before automated delivery.
- Default to **disabled** if credentials, storage, or verification checks fail.
- Keep credentials in dedicated Worker secrets; do not commit secrets.
- Log publishing results, but never log credentials.

## Implementation checklist

- [x] Create isolated GitHub feature branch.
- [x] Create isolated service directory and architecture contract.
- [ ] Implement Worker code, news verification, graphics pipeline and R2 binding.
- [ ] Provision separate R2 bucket and dedicated Worker secrets.
- [ ] Add scheduled trigger and persistent deduplication store.
- [ ] Test end-to-end with publishing disabled.
- [ ] Verify website deployment and CMS are unchanged.
- [ ] Enable automatic posting after successful tests.

**Status:** This is a development scaffold, not an active automation service.
