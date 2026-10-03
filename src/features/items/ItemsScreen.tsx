import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';

export function ItemsScreen() {
  return (
    <>
      <ScreenHeader title="Items" />
      <Card title="Items">
        <p>Search, presets and leeches appear here.</p>
      </Card>
    </>
  );
}
