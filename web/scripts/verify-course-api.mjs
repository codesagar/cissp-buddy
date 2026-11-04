import assert from 'node:assert/strict';

const baseUrl = (
  process.env.COURSE_API_BASE_URL || 'http://localhost:3000'
).replace(/\/$/, '');

const requestJson = async (path, expectedStatus) => {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json();
  assert.equal(
    response.status,
    expectedStatus,
    `${path}: expected ${expectedStatus}, received ${response.status}: ${JSON.stringify(body)}`,
  );
  return { response, body };
};

const { response: manifestResponse, body: manifest } = await requestJson(
  '/api/course',
  200,
);
assert.equal(manifest.counts.units, 90);
assert.equal(manifest.counts.concepts, 698);
assert.equal(manifest.counts.conceptOccurrences, 892);
assert.equal(manifest.units.length, 90);
assert.equal('sections' in manifest.units[0], false);
assert.equal(
  manifestResponse.headers.get('x-course-release'),
  manifest.releaseId,
);

const firstId = manifest.units[0].id;
const { response: unitResponse, body: unit } = await requestJson(
  `/api/course/units/${firstId}?release=${manifest.releaseId}`,
  200,
);
assert.equal(unit.id, firstId);
assert.equal(unit.releaseId, manifest.releaseId);
assert.equal(unit.concepts.length, unit.conceptIds.length);
assert.ok(unit.sections.length > 0);
assert.equal(unitResponse.headers.get('x-course-release'), manifest.releaseId);

const { response: connectionsResponse, body: connections } = await requestJson(
  `/api/course/connections?release=${manifest.releaseId}`,
  200,
);
assert.equal(connections.releaseId, manifest.releaseId);
assert.equal(connections.cases.length, 11);
assert.equal(connections.referenceRelationships.length, 21);
assert.equal('model' in connections.cases[0], false);
assert.equal(
  connectionsResponse.headers.get('x-course-release'),
  manifest.releaseId,
);
const firstConnectionId = connections.cases[0].id;
const { response: connectionResponse, body: connection } = await requestJson(
  `/api/course/connections/${firstConnectionId}?release=${manifest.releaseId}`,
  200,
);
assert.equal(connection.id, firstConnectionId);
assert.equal(connection.releaseId, manifest.releaseId);
assert.equal(connection.model.unitId, firstConnectionId);
assert.equal(
  connectionResponse.headers.get('x-course-release'),
  manifest.releaseId,
);

await requestJson('/api/course?release=missing-release', 404);
await requestJson('/api/course?release=../invalid', 400);
await requestJson('/api/course/units/d1-o99-does-not-exist', 404);
await requestJson('/api/course/units/not-valid', 400);
await requestJson('/api/course/connections?release=missing-release', 404);
await requestJson(
  '/api/course/connections/cross-missing--does-not-exist',
  404,
);
await requestJson('/api/course/connections/not-valid', 400);

console.log(
  JSON.stringify(
    {
      releaseId: manifest.releaseId,
      manifestBytes: Buffer.byteLength(JSON.stringify(manifest)),
      unitId: unit.id,
      unitBytes: Buffer.byteLength(JSON.stringify(unit)),
      connectionIndexBytes: Buffer.byteLength(JSON.stringify(connections)),
      connectionId: connection.id,
      connectionBytes: Buffer.byteLength(JSON.stringify(connection)),
      counts: manifest.counts,
      unknownRelease: 404,
      unknownUnit: 404,
    },
    null,
    2,
  ),
);
