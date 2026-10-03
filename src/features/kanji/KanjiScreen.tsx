import { ScreenHeader } from '../../components/ScreenHeader';
import { KanjiMode } from './KanjiMode';

export function KanjiScreen() {
  return (
    <>
      <ScreenHeader title="Kanji" aside="Known means Guru or higher" />
      <KanjiMode />
    </>
  );
}
