import { createFileRoute } from '@tanstack/react-router';
import { ReadingsScreen } from '../features/readings/ReadingsScreen';

export const Route = createFileRoute('/readings')({ component: ReadingsScreen });
