import { useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Select } from '../../components/Select';
import { usePref, type Prefs } from '../../db/prefs';
import styles from './Coverage.module.css';
import { ByLevelMode } from './ByLevelMode';
import { KanjiMode } from './KanjiMode';
import { KNOWN_STAGES } from './stage';
import { WordsMode } from './WordsMode';

const MODES = [
  { value: 'kanji', label: 'Kanji' },
  { value: 'words', label: 'Words' },
  { value: 'level', label: 'By level' },
] as const;

export function CoverageScreen() {
  const [mode, setMode] = useState<(typeof MODES)[number]['value']>('kanji');
  const [knownStage, setKnownStage] = usePref('knownStage');
  return (
    <>
      <ScreenHeader
        title="Coverage"
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
      {mode === 'kanji' ? <KanjiMode /> : mode === 'words' ? <WordsMode /> : <ByLevelMode />}
    </>
  );
}
