import { createFileRoute } from '@tanstack/react-router';
import { WelcomeScreen } from '../features/welcome/WelcomeScreen';

export const Route = createFileRoute('/welcome')({ component: WelcomeScreen });
