import { Router, type Request } from 'express';
import { ValidationError } from '../../domain/error/DomainErrors.js';
import type { Container } from '../../infrastructure/config/container.js';
import { toZoneDetailDto } from '../dto/dtos.js';

function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`Missing parameter: ${name}`);
  }
  return value;
}

/** Controllers are thin: read the request, call one use case, answer. */
export function createRouter(container: Container): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/zones', async (_req, res) => {
    res.json(await container.getZonesRisk.execute());
  });

  router.get('/zones/:id', async (req, res) => {
    const detail = await container.getZoneDetail.execute(requireParam(req, 'id'));
    res.json(toZoneDetailDto(detail));
  });

  router.get('/fires', async (req, res) => {
    const zoneId = typeof req.query['zoneId'] === 'string' ? req.query['zoneId'] : undefined;
    res.json(await container.getFireHistory.execute(zoneId));
  });

  router.get('/hotspots', async (_req, res) => {
    res.json(await container.getHotspots.execute());
  });

  return router;
}
