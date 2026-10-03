import { createFileRoute } from '@tanstack/react-router';
import { TimelineScreen } from '../features/timeline/TimelineScreen';

export const Route = createFileRoute('/timeline')({ component: TimelineScreen });
