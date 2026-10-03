import { createFileRoute } from '@tanstack/react-router';
import { ItemsScreen } from '../features/items/ItemsScreen';

export const Route = createFileRoute('/items')({ component: ItemsScreen });
