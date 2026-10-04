# Deploying WaniStats

WaniStats is a static site. `pnpm build` writes everything to `dist/`.

- **Cloudflare (primary):** deployed as a Worker with static assets only (no Worker script), configured in
  `wrangler.jsonc`. Routes without a file fall back to `index.html` (`not_found_handling`), and
  `public/_headers` sets the security headers and caching.
- **Netlify (fallback):** `netlify.toml` holds the build settings, the same headers and the SPA fallback.

Keep `public/_headers` and `netlify.toml` in step when either changes.

## Cloudflare

CI deploys: every push to `main` deploys production to `wanistats.com`, and every pull request from
this repository gets a preview URL (`https://pr-<number>-wanistats.<your-subdomain>.workers.dev`).
Both reuse the `dist` the check job built and run only after unit and e2e tests pass.

### One-time setup in Cloudflare

1. **Account ID:** in the Cloudflare dashboard open **Workers & Pages**; copy the **Account ID**
   from the right-hand column (or **Account home**, the three dots next to the account name).
2. **API token:** **My Profile**, **API Tokens**, **Create Token**, **Create Custom Token**:
   - Name: `wanistats-github-deploy`
   - Permissions:
     - Account, **Workers Scripts**, Edit
     - Zone, **Workers Routes**, Edit
     - Zone, **DNS**, Edit (lets the first deploy create the custom domain record)
   - Account resources: your account. Zone resources: **Specific zone**, `wanistats.com`.
   - Optional: client IP filtering off (GitHub runners use many IPs); set a TTL if you rotate tokens.
   - Create, then copy the token once; Cloudflare will not show it again.
3. **workers.dev subdomain:** **Workers & Pages**, **Overview**: if no `*.workers.dev` subdomain is
   set yet, choose one (used for PR preview URLs).
4. **SSL/TLS** for the `wanistats.com` zone: mode **Full (strict)**, and turn on **Always Use HTTPS**
   under **Edge Certificates**.

### One-time setup in GitHub

In the repository, **Settings**:

1. **Secrets and variables**, **Actions**, **Variables** tab, **New repository variable**:
   `CLOUDFLARE_ACCOUNT_ID` = the account ID. Deploy jobs stay skipped until this exists, so CI is
   green before Cloudflare is set up.
2. **Environments**, **New environment** `production`:
   - **Environment secrets**: add `CLOUDFLARE_API_TOKEN` = the token.
   - **Deployment branches and tags**: **Selected branches and tags**, add `main`.
   - Optional: **Required reviewers** if you want to approve each production deploy.
3. **Environments**, **New environment** `preview`:
   - **Environment secrets**: add `CLOUDFLARE_API_TOKEN` (the same token, or a second one with
     only Account, Workers Scripts, Edit).
   - Leave deployment branches unrestricted so pull request branches can deploy previews.
4. Push to `main` (or re-run the latest CI run on `main`). The `deploy` job runs
   `wrangler deploy`, which uploads `dist` and attaches the custom domain `wanistats.com`
   (it creates the DNS record and certificate on the first run).

### Redirect `www` to the apex

`wrangler.jsonc` serves only `wanistats.com`. For `www`:

1. In the `wanistats.com` zone, **DNS**, **Records**, add `AAAA` `www` `100::`, **Proxied** (a
   placeholder so Cloudflare answers for `www`).
2. **Rules**, **Redirect Rules**, **Create rule**:
   - When incoming requests match: **Hostname** equals `www.wanistats.com`.
   - Then: **Dynamic**, expression `concat("https://wanistats.com", http.request.uri.path)`,
     status **301**, **Preserve query string** on.

### Check

- `curl -sI https://wanistats.com/ | grep -i content-security-policy`
- `curl -sI https://wanistats.com/timeline` returns `200` (SPA fallback).
- `curl -sI https://wanistats.com/data/packs/manifest.json` returns `200`, and a pack file returns
  `Content-Type: application/gzip` with no `Content-Encoding`.
- `curl -sI https://www.wanistats.com/` returns `301` to `https://wanistats.com/`.

### Deploying by hand

With `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exported (or after `pnpm dlx wrangler@4 login`):

```sh
pnpm build
pnpm dlx wrangler@4 deploy                 # production
pnpm dlx wrangler@4 versions upload --preview-alias test   # preview URL only
pnpm dlx wrangler@4 dev                    # serve dist locally the way Cloudflare does
```

Rollback: **Workers & Pages**, `wanistats`, **Deployments**, pick an earlier version, **Deploy**
(or `pnpm dlx wrangler@4 rollback`).

## Netlify

1. **Add new site**, **Import an existing project**, pick the repository.
2. Netlify reads `netlify.toml`: build command `pnpm build && rm dist/_headers`, publish
   directory `dist`, Node 24, and the SPA fallback redirect. The `rm` stops Netlify from applying `_headers` on top of the
   `netlify.toml` rules. No dashboard settings are needed.
3. Deploy.
4. Custom domain: **Domain management**, **Add a domain**, enter `wanistats.com`. Either use
   Netlify DNS (change the registrar's nameservers) or point an `A` record for the apex at
   Netlify's load balancer and a `CNAME` for `www` at `<site>.netlify.app`, as the dashboard shows.
5. Add `www.wanistats.com` as a domain alias and set `wanistats.com` as the **primary domain**.
   Netlify then redirects `www` to the apex with a 301.
6. **HTTPS**: wait for the Let's Encrypt certificate, then turn on **Force HTTPS**.
7. Run the same `curl` checks as above.

## Before a release

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- `pnpm test:e2e` (builds, then runs Playwright against `pnpm preview`).
- After deploy, open the site, check the console for CSP errors, and install it once from Chrome
  to confirm the PWA still installs.
