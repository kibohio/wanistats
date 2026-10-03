import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';

export function SettingsScreen() {
  return (
    <>
      <ScreenHeader title="Settings" />
      <Card title="Account">
        <p>Account, sync, history, data packs and preferences appear here.</p>
      </Card>
    </>
  );
}
