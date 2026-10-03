import { useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Select } from '../../components/Select';
import { usePref, type Prefs } from '../../db/prefs';
import styles from './Kanji.module.css';
import { KanjiMode } from './KanjiMode';
import { KNOWN_STAGES } from './stage';
import { WordsMode } from './WordsMode';

const MODES = [
  { value: 'kanji', label: 'Kanji' },
  { value: 'words', label: 'Words' },
] as const;

export function KanjiScreen() {
  const [mode, setMode] = useState<'kanji' | 'words'>('kanji');
  const [knownStage, setKnownStage] = usePref('knownStage');
  return (
    <>
      <ScreenHeader
        title="Kanji"
        aside={
          <label className={styles.knownAt}>
            Known at
            <Select
              value={knownStage}
              onChange={(e) => void setKnownStage(Number(e.target.value) as Prefs['knownStage'])}
            >
              {KNOWN_STAGES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
        }
      />
      <SegmentedControl label="Mode" options={MODES} value={mode} onChange={setMode} />
      {mode === 'kanji' ? <KanjiMode /> : <WordsMode />}
    </>
  );
}
