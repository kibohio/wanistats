import { createFileRoute } from '@tanstack/react-router';
import { PaceScreen } from '../features/pace/PaceScreen';

export const Route = createFileRoute('/pace')({ component: PaceScreen });
