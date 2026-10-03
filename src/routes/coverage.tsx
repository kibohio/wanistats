import { createFileRoute } from '@tanstack/react-router';
import { CoverageScreen } from '../features/coverage/CoverageScreen';

export const Route = createFileRoute('/coverage')({ component: CoverageScreen });
