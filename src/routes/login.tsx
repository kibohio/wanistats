import { createFileRoute } from '@tanstack/react-router';
import { LoginScreen } from '../features/login/LoginScreen';

export const Route = createFileRoute('/login')({ component: LoginScreen });
