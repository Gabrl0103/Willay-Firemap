import cors from 'cors';
import express, { type Express } from 'express';
import type { Container } from '../../infrastructure/config/container.js';
import { errorHandler, notFoundHandler } from './errorHandler.js';
import { createRouter } from './routes.js';

export function createApp(container: Container): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', createRouter(container));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
