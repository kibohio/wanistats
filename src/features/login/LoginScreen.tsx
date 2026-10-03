import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';

export function LoginScreen() {
  return (
    <>
      <ScreenHeader title="Log in" />
      <Card title="Connect your WaniKani account">
        <p>
          Paste a personal access token. WaniStats only needs read access. Your token stays in this
          browser and is only ever sent to api.wanikani.com.
        </p>
      </Card>
    </>
  );
}
