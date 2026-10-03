# WaniStats

A WaniKani stats companion at [wanistats.com](https://wanistats.com). It answers three questions: when you level up, whether your workload is healthy, and when you finish.

WaniStats runs entirely in your browser. There is no account and no server: your read-only API token, synced data and daily history stay in this browser's IndexedDB, and the only network requests go to `api.wanikani.com`. Logged-out visitors get the full app with sample data.

## Features

- **Today**: earliest level-up and the kanji it rests on, workload, projected finish.
- **Timeline**: reviews for up to 120 days, level-critical and burn markers, a lesson-time window.
- **Pace**: finish date with a likely range, a what-if pace slider, time per level with resets.
- **Kanji**: coverage by JLPT, Jōyō, frequency and WaniKani level, plus word coverage from opt-in data packs.
- **Items**: search, leeches with look-alikes, accuracy.
- **History**: the API keeps lifetime totals only, so WaniStats saves a daily snapshot on the device. Export it from Settings.
- Installable PWA that works offline from the last sync. Light and dark themes.

## Development

Tooling comes from [devbox](https://www.jetify.com/devbox) (Node and pnpm) with [direnv](https://direnv.net). With both installed, `direnv allow` in the repository, then:

```sh
pnpm install
pnpm dev            # http://localhost:5173
pnpm test           # unit and component tests (Vitest)
pnpm test:e2e       # end-to-end tests (Playwright, Chromium)
pnpm lint
pnpm build && pnpm preview
pnpm data:refresh   # rebuild coverage data packs from Jiten, KANJIDIC2 and the JLPT lists
pnpm icons          # rebuild app icons from public/icons/source.svg
```

Without direnv, prefix commands with `devbox run --`.

To try it with your own account, create a read-only personal access token at [WaniKani](https://www.wanikani.com/settings/personal_access_tokens) and paste it on the login screen.

Deployment to Cloudflare Pages or Netlify is described in [DEPLOY.md](DEPLOY.md).

## Data and licences

Code: MIT, see [LICENSE](LICENSE). Coverage data packs are derived from [Jiten](https://jiten.moe) (CC BY-SA 4.0), KANJIDIC2 by the EDRDG (CC BY-SA 4.0) and Jonathan Waller's JLPT lists (CC BY), and stay under CC BY-SA 4.0. See [public/data/LICENSE-DATA.md](public/data/LICENSE-DATA.md).

Built and maintained by Kiboh Inc. Not affiliated with WaniKani or Tofugu.
