# Data licences

The WaniStats code is MIT licensed. The data files described here are separate works with their own licences.

## Files covered

- `public/data/packs/*.json.gz`: the opt-in coverage data packs (`kanji`, `words-global`, `words-anime`, `words-novel`).
- `src/packs/sampleCoverage.ts`: the built-in "Sample coverage data", a small slice of the `kanji` and `words-global` packs.

These files are derived from the sources below. As required by CC BY-SA 4.0, **the derived data is licensed under CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/). Kiboh Inc. claims no copyright over the source material.

Changes made: the lists were filtered (top 20,000 words per list, kanji present in KANJIDIC2 only), duplicate word and reading pairs were merged keeping the best rank, fields were joined across sources, and the result was re-encoded as compact column JSON with delta-encoded ranks. `pnpm data:refresh` rebuilds the files from the current sources.

## Sources

### Jiten

Word and kanji frequency data from Jiten (https://jiten.moe), CC BY-SA 4.0. Modified: top 20,000 entries, re-encoded.

### JMdict and KANJIDIC2 (EDRDG)

This site uses the JMdict and KANJIDIC2 dictionary files. These files are the property of the Electronic Dictionary Research and Development Group, and are used in conformance with the Group's licence (https://www.edrdg.org/edrdg/licence.html).

- KANJIDIC2: https://www.edrdg.org/wiki/index.php/KANJIDIC_Project (Jōyō grades and stroke counts)
- JMdict: https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project (the word spellings and readings in Jiten's lists)

Licence: EDRDG General Dictionary Licence, CC BY-SA 4.0.

### JLPT levels (unofficial)

JLPT levels (unofficial) from Jonathan Waller's JLPT Resources (http://www.tanos.co.uk/jlpt/), CC BY.

Compiled via kanji-data by David Gouveia (https://github.com/davidluzgouveia/kanji-data), MIT. Only the JLPT level field is used. Licence notice:

```
MIT License

Copyright (c) 2019 David Gouveia

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

No official JLPT kanji list exists. These levels are an unofficial estimate.
