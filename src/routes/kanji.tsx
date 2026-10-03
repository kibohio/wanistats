import { createFileRoute, redirect } from '@tanstack/react-router';

// The screen was called Kanji before it also covered words; old links and bookmarks still work.
export const Route = createFileRoute('/kanji')({
  beforeLoad: () => {
    throw redirect({ to: '/coverage', replace: true });
  },
});
