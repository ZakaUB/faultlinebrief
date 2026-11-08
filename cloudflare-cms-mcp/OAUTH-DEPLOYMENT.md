# OAuth deployment runbook — staging only

This implementation uses Cloudflare's `@cloudflare/workers-oauth-provider` split-worker architecture (v1.x), **not** a home-grown JWT validator. Auth Worker `oauth-auth-server.js` issues OAuth tokens after GitHub login; MCP resource Worker `oauth-resource.js` validates tokens over the `AUTH_SERVER` service binding. The provider verifies token expiry, revocation and the exact resource audience. The MCP dispatcher checks `cms:read`, `cms:draft`, `cms:publish` per operation and checks `EDITOR_GITHUB_ID` on every request. Publishing additionally needs the separate five-minute editorial approval token.

## Before deployment
1. Create **staging** Cloudflare KV namespace and replace `REPLACE_WITH_STAGING_KV_ID` in `wrangler.cms.oauth.auth.json`.
2. Create a GitHub OAuth App (Settings → Developer settings → OAuth Apps) with callback `https://cms-auth.faultlinebrief.com/callback`. Store `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` as **auth Worker secrets**; never commit credentials.
3. Set `EDITOR_GITHUB_ID` to the editor's **numeric GitHub user ID**, not the account handle, in both Workers. The placeholder must be replaced.
4. Provision the two Cloudflare staging routes `https://cms-auth.faultlinebrief.com` and `https://cms-mcp.faultlinebrief.com` **or** change the issuer and resource constants in both JS files to the actual HTTPS routes **before deployment**. Those hostnames are intended configuration, **not currently verified DNS**. Do not point staging at production CMS.
5. Set `CMS_DRAFT_API_URL`, `CMS_DRAFT_API_TOKEN`, `CMS_PUBLISH_API_URL`, `CMS_PUBLISH_API_TOKEN` as **MCP Worker secrets** targeting a dedicated staging CMS; never commit them. The CMS-side token must match the editor Worker secret.
6. Run `npm install` in `cloudflare-cms-mcp` and deploy with the relevant Wrangler configuration after binding the `AUTH_SERVER` service to the auth Worker. The OAuth authorization server needs `OAUTH_KV`; the MCP resource Worker does **not** need direct D1/R2 access.
7. Test OAuth discovery, PKCE, GitHub login, explicit client consent, valid/expired/wrong-audience/revoked token behavior, denied scopes, GitHub ID mismatch, and a staged draft approval/publish cycle. Confirm public article URL, sitemap, RSS and image handling.
8. Do not merge or deploy to production until staging passes and the editor explicitly approves the rollout.

**Caveat:** These files are implementation code but have not yet been deployed or end-to-end verified. GitHub OAuth configuration, KV ID, routes, and secret values require authorized account configuration. OAuth alone never constitutes permission to publish an article.
