import { createFileRoute } from '@tanstack/react-router';
import { PrivacyPage } from '../features/legal/LegalPage';

export const Route = createFileRoute('/privacy')({ component: PrivacyPage });
