import { createFileRoute } from '@tanstack/react-router';
import { KanjiScreen } from '../features/kanji/KanjiScreen';

export const Route = createFileRoute('/kanji')({ component: KanjiScreen });
