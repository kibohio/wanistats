import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';

export function KanjiScreen() {
  return (
    <>
      <ScreenHeader title="Kanji" />
      <Card title="Coverage">
        <p>Kanji and word coverage appear here.</p>
      </Card>
    </>
  );
}
