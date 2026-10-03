import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';

export function TodayScreen() {
  return (
    <>
      <ScreenHeader title="Today" />
      <Card title="Next level-up">
        <p>Level-up date, workload and finish date appear here.</p>
      </Card>
    </>
  );
}
