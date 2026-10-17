# Cloudflare staging — Payload local authentication blocker

Status: unresolved upstream compatibility. **Never deploy this staging branch to production.**

- Staging deploy and Payload read-only operations pass.
- The disposable staging administrator create request fails with `NotSupportedError` before login.
- Payload v3.90.x increased PBKDF2-SHA256 work factor to 600,000 iterations for security.
- Cloudflare Workers rejects PBKDF2 operations above 100,000 iterations (see https://github.com/payloadcms/payload/issues/18274).
- Suspected root cause is this runtime conflict; the sanitized test did not capture the full nested message.
- Do not downgrade Payload below 3.90.0, reduce hashing strength, patch crypto primitives without security review, or silently bypass local authentication.
- The temporary account-creation test route has been removed after diagnosis. Production database, website, and DNS remain untouched.
- Safe next path: upstream Cloudflare-compatible Payload fix that retains suitable password hashing strength, or a separately isolated Node-based auth/CMS runtime. Before approving migration, re-test create/login, editing, publish, and R2 media.
