import { createFileRoute } from '@tanstack/react-router';
import { TermsPage } from '../features/legal/LegalPage';

export const Route = createFileRoute('/terms')({ component: TermsPage });
