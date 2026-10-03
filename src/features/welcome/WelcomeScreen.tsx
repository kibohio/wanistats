import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';

export function WelcomeScreen() {
  return (
    <>
      <ScreenHeader title="Welcome" />
      <Card title="Your WaniKani, at a glance">
        <p>A short introduction appears here after your first sync.</p>
      </Card>
    </>
  );
}
