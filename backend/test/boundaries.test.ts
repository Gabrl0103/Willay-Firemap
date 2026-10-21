import assert from 'node:assert/strict';
import { once } from 'node:events';
import { get as httpGet, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import type { BoundaryGeometry, Position } from '../src/domain/model/ZoneBoundary.js';
import { joinBoundaries } from '../src/domain/service/boundaryJoin.js';
import { buildContainer } from '../src/infrastructure/config/container.js';
import { NARINO_BOUNDARIES } from '../src/infrastructure/geo/narinoBoundaries.js';
import { NARINO_MUNICIPALITIES } from '../src/infrastructure/persistence/narinoMunicipalities.js';
import { createApp } from '../src/presentation/http/app.js';

const SQUARE: BoundaryGeometry = { type: 'Polygon', coordinates: [[[-77, 1], [-77.1, 1], [-77.1, 1.1], [-77, 1]]] };

function rings(geometry: BoundaryGeometry): (readonly Position[])[] {
  return geometry.type === 'Polygon' ? [...geometry.coordinates] : geometry.coordinates.flat();
}

describe('joinBoundaries (by DIVIPOLA code)', () => {
  const zones = [
    { divipola: 52001, id: 'pasto', name: 'Pasto' },
    { divipola: 52835, id: 'tumaco', name: 'San Andrés de Tumaco' },
  ];

  it('gives each boundary the id and name of its zone, in the order of the zones', () => {
    const { boundaries, unmatchedCodes, zonesWithoutBoundary } = joinBoundaries(
      [{ divipola: 52835, geometry: SQUARE }, { divipola: 52001, geometry: SQUARE }],
      zones,
    );
    assert.deepEqual(boundaries.map((b) => [b.zoneId, b.divipola, b.name]), [
      ['pasto', 52001, 'Pasto'],
      ['tumaco', 52835, 'San Andrés de Tumaco'],
    ]);
    assert.deepEqual(unmatchedCodes, []);
    assert.deepEqual(zonesWithoutBoundary, []);
  });

  it('reports codes no zone has, repeated codes and zones left without a boundary', () => {
    const { boundaries, unmatchedCodes, zonesWithoutBoundary } = joinBoundaries(
      [{ divipola: 52001, geometry: SQUARE }, { divipola: 52001, geometry: SQUARE }, { divipola: 19001, geometry: SQUARE }],
      zones,
    );
    assert.deepEqual(boundaries.map((b) => b.zoneId), ['pasto']);
    assert.deepEqual(unmatchedCodes.sort(), [19001, 52001]);
    assert.deepEqual(zonesWithoutBoundary, ['tumaco']);
  });
});

describe('boundaries of Nariño (DANE MGN 2025)', () => {
  it('match the 64 zones by code, one each', () => {
    assert.deepEqual(NARINO_BOUNDARIES.unmatchedCodes, []);
    assert.deepEqual(NARINO_BOUNDARIES.zonesWithoutBoundary, []);
    assert.equal(NARINO_BOUNDARIES.boundaries.length, NARINO_MUNICIPALITIES.length);
    assert.equal(new Set(NARINO_BOUNDARIES.boundaries.map((b) => b.zoneId)).size, 64);
  });

  it('are valid polygons inside the department, with closed rings', () => {
    for (const { zoneId, geometry } of NARINO_BOUNDARIES.boundaries) {
      assert.ok(geometry.type === 'Polygon' || geometry.type === 'MultiPolygon', zoneId);
      for (const ring of rings(geometry)) {
        assert.ok(ring.length >= 4, `${zoneId}: ring of ${ring.length} points`);
        assert.deepEqual(ring[0], ring[ring.length - 1], `${zoneId}: open ring`);
        for (const [longitude, latitude] of ring) {
          assert.ok(longitude > -79.1 && longitude < -76.7 && latitude > 0.3 && latitude < 2.8, `${zoneId}: ${longitude},${latitude}`);
        }
      }
    }
  });

  it('contain the seat of each municipality (the zone point)', () => {
    // Ray casting on the outer rings; holes do not matter for a seat.
    const inside = ([x, y]: Position, ring: readonly Position[]): boolean => {
      let result = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]!;
        const [xj, yj] = ring[j]!;
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) result = !result;
      }
      return result;
    };
    const outside = NARINO_MUNICIPALITIES.filter((m) => {
      const boundary = NARINO_BOUNDARIES.boundaries.find((b) => b.zoneId === m.id)!;
      const outers = boundary.geometry.type === 'Polygon' ? [boundary.geometry.coordinates[0]!] : boundary.geometry.coordinates.map((p) => p[0]!);
      return !outers.some((ring) => inside([m.longitude, m.latitude], ring));
    });
    assert.deepEqual(outside.map((m) => m.id), []);
  });
});

describe('GET /api/zones/boundaries', () => {
  async function withServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
    const server = createApp(buildContainer({ port: 0, ingestionEnabled: false })).listen(0);
    await once(server, 'listening');
    try {
      return await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    } finally {
      server.close();
    }
  }
  const get = (path: string, headers: Record<string, string> = {}) =>
    withServer((baseUrl) => fetch(`${baseUrl}${path}`, { headers }));

  it('answers the 64 features keyed by zone id, cacheable and gzipped', async () => {
    const response = await get('/api/zones/boundaries', { 'Accept-Encoding': 'gzip' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=86400');
    assert.equal(response.headers.get('content-encoding'), 'gzip');
    assert.ok(response.headers.get('etag'));
    const body = (await response.json()) as {
      type: string;
      source: string;
      features: Array<{ id: string; properties: { id: string; divipola: number; name: string }; geometry: { type: string } }>;
    };
    assert.equal(body.type, 'FeatureCollection');
    assert.match(body.source, /DANE/);
    assert.equal(body.features.length, 64);
    const tumaco = body.features.find((f) => f.id === 'tumaco');
    assert.deepEqual(tumaco?.properties, { id: 'tumaco', divipola: 52835, name: 'San Andrés de Tumaco' });
  });

  it('answers 304 when the phone already has them', async () => {
    // node:http, not fetch: fetch adds "Cache-Control: no-cache" to conditional requests.
    const status = await withServer(async (baseUrl) => {
      const etag = (await fetch(`${baseUrl}/api/zones/boundaries`)).headers.get('etag')!;
      const request = httpGet(`${baseUrl}/api/zones/boundaries`, { headers: { 'If-None-Match': etag } });
      const [response] = (await once(request, 'response')) as [IncomingMessage];
      response.resume();
      return response.statusCode;
    });
    assert.equal(status, 304);
  });
});
