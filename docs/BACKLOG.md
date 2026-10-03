# Backlog

Ideas deliberately left out of v1.

## Cloud sync for history

Keep history in step across phones and PCs through a storage provider the user already has. Opt-in, client-only, no WaniStats server.

- Providers: Dropbox first (OAuth PKCE without a client secret, CORS-enabled API, app-folder scope). WebDAV/Nextcloud second, as an advanced option, since many servers need CORS configured by the user. Google Drive last: its sign-in library is a third-party script, which the CSP forbids, so it needs a hand-rolled OAuth flow.
- Merge rule: snapshot deltas are counted against the previous snapshot, so two devices must not each record the same span. Pull remote history before writing the day's snapshot, write it against the merged baseline, then push. One snapshot per account per day; newer `takenAt` wins.
- Per account: one remote file per WaniKani user id, matching the per-account local databases.
- Privacy: adds the provider's API to `connect-src` and needs a section on the Privacy page. Off by default.
- Until then: Settings, History export and import through a folder a cloud client already syncs.
