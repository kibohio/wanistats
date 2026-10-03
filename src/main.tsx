import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { queryClient, router } from './router';
// Zen Kaku Gothic New in Latin only: the UI copy is English and kana fall back to the system gothic.
import '@fontsource/zen-kaku-gothic-new/latin-400.css';
import '@fontsource/zen-kaku-gothic-new/latin-ext-400.css';
import '@fontsource/zen-kaku-gothic-new/latin-500.css';
import '@fontsource/zen-kaku-gothic-new/latin-ext-500.css';
import '@fontsource/zen-kaku-gothic-new/latin-700.css';
import '@fontsource/zen-kaku-gothic-new/latin-ext-700.css';
import '@fontsource/shippori-mincho-b1/latin-700.css';
import './styles/global.css';

// Shippori Mincho B1 500 for kanji: about 120 unicode-range faces, so it loads after first paint.
void import('@fontsource/shippori-mincho-b1/500.css');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
