# Deploying WaniStats

WaniStats is a static site. `pnpm build` writes everything to `dist/`. Headers and the SPA
fallback ship with the build:

- `public/_redirects`: `/*  /index.html  200` (both hosts read it).
- `public/_headers`: security headers and caching for Cloudflare Pages.
- `netlify.toml`: the same headers for Netlify, plus build settings.

Keep `public/_headers` and `netlify.toml` in step when either changes.

## Cloudflare Pages (primary)

1. In the Cloudflare dashboard open **Workers & Pages**, **Create**, **Pages**, **Connect to Git**,
   and pick the `wanistats` repository.
2. Build settings:
   - Framework preset: **None**
   - Build command: `pnpm build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `24`
3. Save and deploy. Every push to `main` deploys production; pull requests get preview URLs.
4. Custom domain:
   - Add `wanistats.com` as a zone in Cloudflare (change the registrar's nameservers to the two
     Cloudflare gives you) if it is not there already.
   - In the Pages project open **Custom domains**, **Set up a custom domain**, enter
     `wanistats.com` and confirm. Cloudflare adds the DNS record.
   - Repeat for `www.wanistats.com`.
5. Redirect `www` to the apex:
   - In the `wanistats.com` zone open **Rules**, **Redirect Rules**, **Create rule**.
   - When incoming requests match: **Hostname** equals `www.wanistats.com`.
   - Then: **Dynamic** redirect to `concat("https://wanistats.com", http.request.uri.path)`,
     status **301**, **Preserve query string** on.
6. In **SSL/TLS** set the mode to **Full (strict)** and turn on **Always Use HTTPS**.
7. Check:
   - `curl -sI https://wanistats.com/ | grep -i content-security-policy`
   - `curl -sI https://www.wanistats.com/` returns `301` to `https://wanistats.com/`.
   - `curl -sI https://wanistats.com/timeline` returns `200` (SPA fallback).

## Netlify

1. **Add new site**, **Import an existing project**, pick the repository.
2. Netlify reads `netlify.toml`: build command `pnpm build && rm dist/_headers`, publish
   directory `dist`, Node 24. The `rm` stops Netlify from applying `_headers` on top of the
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
