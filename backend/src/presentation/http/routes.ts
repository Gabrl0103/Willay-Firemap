import { Router, type Request } from 'express';
import { ValidationError } from '../../domain/error/DomainErrors.js';
import type { Container } from '../../infrastructure/config/container.js';
import { toZoneBoundariesDto, toZoneDetailDto, toZoneForecastDto } from '../dto/dtos.js';

/** The boundaries only change with a new build, so phones may keep them a day (Express adds the ETag). */
const BOUNDARIES_CACHE_CONTROL = 'public, max-age=86400';

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

  // Before /zones/:id, or Express would take "boundaries" as a zone id.
  router.get('/zones/boundaries', (_req, res) => {
    res.set('Cache-Control', BOUNDARIES_CACHE_CONTROL).json(toZoneBoundariesDto(container.getZoneBoundaries.execute()));
  });

  router.get('/zones/:id', async (req, res) => {
    const detail = await container.getZoneDetail.execute(requireParam(req, 'id'));
    res.json(toZoneDetailDto(detail));
  });

  router.get('/zones/:id/forecast', async (req, res) => {
    res.json(toZoneForecastDto(await container.getZoneForecast.execute(requireParam(req, 'id'))));
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
