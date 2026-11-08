# Faultline Brief CMS MCP (isolated, not deployed)

This is a separate Cloudflare Worker, with **no D1 or R2 bindings**, for ChatGPT-to-CMS editorial workflows.

## Existing CMS audit

- `cloudflare-editor/draft-integration.js`: bearer-token authenticated draft list/read/create/update; requires `EDITOR_PRODUCTION_MODE=live` and `EDITOR_DRAFT_API_TOKEN`.
- `cloudflare-editor/worker.js`: browser session-based article editing and publishing; do not reuse the browser session cookie or bootstrap password for machine publishing.
- `wrangler.editor.d1.production.json`: production D1 and R2 bindings are held by the editor Worker.
- The draft integration token **cannot publish**. No dedicated approval-based machine publishing API was found in the inspected code.

## Connector configuration (Cloudflare secrets; NEVER commit their values)

```
wrangler deploy -c wrangler.cms.mcp.json
wrangler secret put MCP_ACCESS_TOKEN -c wrangler.cms.mcp.json
wrangler secret put CMS_DRAFT_API_URL -c wrangler.cms.mcp.json
wrangler secret put CMS_DRAFT_API_TOKEN -c wrangler.cms.mcp.json
```

Use 40+ character random `MCP_ACCESS_TOKEN`. Set `CMS_DRAFT_API_URL` to the exact HTTPS editor Worker origin (no path), and `CMS_DRAFT_API_TOKEN` to the editor's existing draft integration token. Protect access with per-user OAuth before connecting this to ChatGPT; static bearer authentication is a development integration boundary, **not a substitute for ChatGPT's supported OAuth setup**.

The remote endpoint is `POST /mcp` (JSON-RPC). The `GET /health` endpoint reports only configuration state.

## Publishing safety

The `publish_approved_draft` tool is **disabled by default**. Its optional `CMS_PUBLISH_API_URL` and `CMS_PUBLISH_API_TOKEN` settings intentionally point to a **future** CMS-side endpoint that must independently verify an explicit, single-use, short-lived editorial approval, the draft ID, expected slug, and the requester's permissions. Never equate an LLM-supplied approval string with proof of user approval. Build the CMS endpoint and OAuth/identity layer, test against staging, and review before enabling production publication.

No existing production Worker, route, D1 schema, R2 bucket, or secret is changed by this branch. No production deployment is performed.

## Approval endpoint implemented (not deployed)

- Editor session (cookie) plus same-origin POST to `/editor/approve-publish` with JSON `{"id":"cf-...","expectedSlug":"..."}` returns a random 5-minute approval token. This call must be made from the authenticated editor interface, never from ChatGPT.
- Bearer-protected POST to `/integration/v1/approved-publish` with JSON `{"id":"cf-...","expectedSlug":"...","approvalToken":"..."}` performs a conditional D1 publication, only for drafts with a featured image.
- Apply `cloudflare-cms-mcp/cms_publish_approvals.sql` to staging D1 before testing.
- Configure `CMS_PUBLISH_API_TOKEN` (40+ characters) as an editor Worker secret, and the same value as the connector's `CMS_PUBLISH_API_TOKEN` secret. Configure connector `CMS_PUBLISH_API_URL` as the editor Worker HTTPS origin.
- **Not yet production-ready:** OAuth identity and ChatGPT connector registration, automated tests, staging deployment, verified public publication/RSS/sitemap behavior, and an editor UI approval button are still required. The static bearer token alone is not user OAuth. Do not deploy or expose publicly until those are complete.

## OAuth integration gate (November 2026)

The MCP Worker now advertises `/.well-known/oauth-protected-resource` when `OAUTH_ISSUER` and `MCP_RESOURCE_URL` are configured. **Metadata is not token verification.** Until a real OAuth provider and resource-server token validator are installed, `POST /mcp` fails closed by default (`oauth-verifier-not-configured`). `REQUIRE_OAUTH=false` is an explicit development-only bypass and must NEVER be set on a publicly reachable production Worker.

Recommended: use Cloudflare Workers OAuth Provider with a GitHub or Google login, consent page, PKCE S256, audience-bound access tokens, scopes `cms:read`, `cms:draft`, `cms:publish`, and a service-binding token verifier. Verify the exact issuer, audience, expiry, and scopes for each tool call. Restrict editor identity to an allowlist; do not grant publish scope merely because someone can log in. The authorization server must publish its own RFC 8414 metadata and support client registration (CIMD or DCR). This remains unimplemented.

ChatGPT custom MCP **write** connections currently require a Business or Enterprise/Edu workspace according to OpenAI's published support documentation. A personal Plus account cannot be assumed to support publishing through a custom MCP app. Alternative: an independent OpenAI API client invoking this MCP server after user approval.

See https://developers.openai.com/plugins/build/auth and https://developers.cloudflare.com/agents/model-context-protocol/protocol/authorization/ for requirements.

## GitHub OAuth implementation (development branch)

Entry point is now `cloudflare-cms-mcp/oauth-worker.js`. It wraps the existing JSON-RPC handler with `@cloudflare/workers-oauth-provider` 1.x. OAuth requests use GitHub login, a short-lived KV-backed state, an explicit per-client consent page, and Cloudflare-issued audience-bound MCP tokens. Each tool checks `cms:read`, `cms:draft` or `cms:publish`; GitHub numeric user ID must match `EDITOR_GITHUB_ID`. The separate CMS one-time approval is still mandatory for publishing.

**Required manual Cloudflare/GitHub setup before staging deploy:**
1. Create a dedicated GitHub OAuth App with callback `https://STAGING-MCP-HOST/oauth/github/callback`. GitHub login alone does not give publishing permission; the GitHub numeric user ID is allowlisted.
2. Create a dedicated staging KV namespace and replace `OAUTH_KV` placeholder in `wrangler.cms.mcp.json`. Replace `MCP_RESOURCE_URL` and `OAUTH_ISSUER` placeholders with canonical HTTPS staging URL.
3. Add Worker secrets `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `EDITOR_GITHUB_ID`, `CMS_DRAFT_API_URL`, `CMS_DRAFT_API_TOKEN`, and (only after staging validation) `CMS_PUBLISH_API_URL`, `CMS_PUBLISH_API_TOKEN`.
4. Install the dependency and update the lockfile before building; CI currently checks syntax and authentication-unit tests, **not** a full OAuth handshake or workerd integration.
5. Verify PKCE, client metadata registration, consent-denial, token revocation, wrong-audience tokens, scope denial, and full publish flow in staging. Do not merge or deploy production until these pass.

The old `MCP_ACCESS_TOKEN` static bearer is no longer used by the OAuth entrypoint. Do not enable the old development-only `REQUIRE_OAUTH=false` bypass.

**Warning:** This is untested OAuth integration code, not a deployed or verified authentication service. GitHub OAuth App registration and KV namespace creation require Cloudflare/GitHub account configuration.
