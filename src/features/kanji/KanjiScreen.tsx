import { useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { KanjiMode } from './KanjiMode';
import { WordsMode } from './WordsMode';

const MODES = [
  { value: 'kanji', label: 'Kanji' },
  { value: 'words', label: 'Words' },
] as const;

export function KanjiScreen() {
  const [mode, setMode] = useState<'kanji' | 'words'>('kanji');
  return (
    <>
      <ScreenHeader title="Kanji" aside="Known means Guru or higher" />
      <SegmentedControl label="Mode" options={MODES} value={mode} onChange={setMode} />
      {mode === 'kanji' ? <KanjiMode /> : <WordsMode />}
    </>
  );
}
