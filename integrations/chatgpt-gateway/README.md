# Faultline Brief — ChatGPT Draft Gateway (Preview only)

Deploy this folder as a **separate Vercel project**, with project Root Directory `integrations/chatgpt-gateway`. Never attach the Production custom domain. The gateway project must accept HTTPS requests from GPT Actions, while the original Faultline Brief Preview deployment remains protected.

Set the following **server-side environment variables** on the gateway project (Preview environment only; do not commit their values):

- `PAYLOAD_PREVIEW_URL`: the current protected Vercel Preview URL for the `runtime-migration` branch.
- `VERCEL_AUTOMATION_BYPASS_SECRET`: the Vercel protection bypass secret for the original Faultline Brief project.
- `PAYLOAD_API_KEY`: the dedicated Payload **draft_publisher** user's API key (raw value, no `users ` prefix).
- `GATEWAY_API_KEY`: a **new, separate** strong random key for GPT Actions (not the Payload key or Vercel bypass secret).

The GPT Action must send `Authorization: Bearer <GATEWAY_API_KEY>` to this gateway. The gateway injects both the Vercel bypass header and Payload authentication upstream. Only `GET /api/articles` (drafts only) and `POST /api/articles` (forced draft) are supported. No publish/update/delete endpoints are exposed.

Do not deploy this as a route within the protected Faultline Brief project: GPT Actions would still be blocked at Vercel's protection layer. Do not disable the existing project's protection.

**Important:** Test access controls in Preview before relying on this in production. This gateway intentionally never contacts Production. Do not copy Production credentials.
