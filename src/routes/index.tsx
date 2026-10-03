import { createFileRoute } from '@tanstack/react-router';
import { TodayScreen } from '../features/today/TodayScreen';

export const Route = createFileRoute('/')({ component: TodayScreen });
