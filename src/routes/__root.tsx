import { createRootRoute } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell';
import { ScreenHeader } from '../components/ScreenHeader';

export const Route = createRootRoute({
  component: AppShell,
  notFoundComponent: () => <ScreenHeader title="Page not found" />,
});
