import type { Express } from 'express';
import pino from 'pino';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { InMemoryRepository } from '../src/data/inMemoryRepository.js';
import type { Repository } from '../src/data/repository.js';

// Shared harness for the backend-owned contract suites. Each test builds a
// fresh app with a pristine in-memory repository and demo auth (no bearer
// token, no Supabase), then exercises the API through Supertest.

export interface TestApp {
  app: Express;
  repo: Repository;
}

export function createTestApp(): TestApp {
  const env = loadEnv({ DEMO_MODE: 'true', LOG_LEVEL: 'silent' });
  const logger = pino({ level: 'silent' });
  const repo = new InMemoryRepository();
  return { app: createApp(env, logger, repo), repo };
}