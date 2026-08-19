import { defineConfig } from 'vitest/config';

// Backend-owned test configuration. Contract suites hit createApp(...)
// through Supertest; correctness suites import units directly. The backend
// never tests against a live server, live Supabase, or a live payment provider.

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
  },
});