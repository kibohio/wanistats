# Changelog

Notable changes to WaniStats, newest first. Versions follow [semantic versioning](https://semver.org); the version in use is shown in Settings.

## 0.2.0 (2026-10-28)

### Added

- On'yomi drill, a new page in the sidebar and linked from the Items leech view. It lists up to 25 kanji whose on'yomi you miss most and drills just those readings.
  - Kanji are ranked by reading misses and reading accuracy, weighted toward items still in reviews. Kanji where WaniKani wants a kun'yomi are left out.
  - A stage filter limits the list, Guru 2 by default, so kanji at Master and above stay out unless you ask for them.
  - Each kanji shows a vocabulary word that uses the on'yomi, with its WaniKani level. Words you know best come first, then lower levels.
  - The drill asks in random order and brings a missed kanji back a few questions later until it is answered right. Typing the kun'yomi is called out by name.
  - A hint shows the vocabulary word and its meaning without giving away the reading.
  - Nothing is scheduled or saved. Open it, drill, close it.
- Item tooltips show the WaniKani level.
- Footer link to this changelog.

## 0.1.0

First release: Today, Timeline, Pace, Coverage and Items, with an in-app drill for the Items list.
