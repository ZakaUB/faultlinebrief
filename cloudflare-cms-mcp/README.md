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
