import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';

export function TimelineScreen() {
  return (
    <>
      <ScreenHeader title="Timeline" />
      <Card title="Upcoming reviews">
        <p>Reviews by hour and day appear here.</p>
      </Card>
    </>
  );
}
