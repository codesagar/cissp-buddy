export const humanStrata = ['cloud', 'server', 'database'] as const;
export type EvidenceResult = 'pass' | 'failure' | 'missing' | 'exception';
export const evidencePaths = [
  'enrollment',
  'challenge',
  'bypass',
  'reset',
  'sign-in',
] as const;
export type SampleEvidence = Record<string, EvidenceResult>;
export function samplingModel(seedInput: string) {
  const seed = Number(seedInput);
  if (
    !seedInput.trim() ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 4294967295
  )
    return {
      valid: false as const,
      error: 'Use a whole-number seed from 0 to 4,294,967,295.',
    };
  const strata = humanStrata.map((name, stratum) => {
    const population = Array.from(
      { length: 80 },
      (_, i) => `${name}-${String(i + 1).padStart(3, '0')}`,
    ).sort();
    const shuffled = [...population];
    let random = (seed ^ Math.imul(stratum + 1, 0x9e3779b9)) >>> 0;
    if (!random) random = 0x6d2b79f5;
    for (let i = shuffled.length - 1; i > 0; i--) {
      random ^= random << 13;
      random ^= random >>> 17;
      random ^= random << 5;
      const j = Math.floor(((random >>> 0) / 4294967296) * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return { name, population, selected: shuffled.slice(0, 8).sort() };
  });
  return {
    valid: true as const,
    seed,
    strata,
    selected: strata.flatMap((s) => s.selected),
    population: 240,
    selectedCount: 24,
    unselected: 216,
    serviceAccounts: Array.from(
      { length: 18 },
      (_, i) => `service-${String(i + 1).padStart(3, '0')}`,
    ),
    breakGlassAccounts: Array.from(
      { length: 7 },
      (_, i) => `break-glass-${String(i + 1).padStart(3, '0')}`,
    ),
  };
}
export function accountEvidence(
  id: string,
  evidence: SampleEvidence,
): EvidenceResult {
  const results = evidencePaths.map(
    (path) => evidence[`${id}:${path}`] || 'missing',
  );
  if (results.includes('failure')) return 'failure';
  if (results.includes('exception')) return 'exception';
  if (results.includes('missing')) return 'missing';
  return 'pass';
}
export function summarizeSample(ids: string[], evidence: SampleEvidence) {
  const counts = { pass: 0, failure: 0, missing: 0, exception: 0 };
  for (const id of ids) counts[accountEvidence(id, evidence)]++;
  return counts;
}
export const utcClock = (secondsAfterTen: number) => {
  const total = (((36000 + secondsAfterTen) % 86400) + 86400) % 86400;
  return [
    Math.floor(total / 3600),
    Math.floor(total / 60) % 60,
    Math.floor(total % 60),
  ]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
};
export function eventTimelineModel(
  offsetInput: string,
  uncertaintyInput: string,
  measured: boolean,
) {
  const offset = Number(offsetInput),
    uncertainty = Number(uncertaintyInput);
  if (
    measured &&
    (!uncertaintyInput.trim() ||
      !Number.isInteger(uncertainty) ||
      uncertainty < 0 ||
      uncertainty > 120 ||
      !offsetInput.trim() ||
      !Number.isInteger(offset) ||
      Math.abs(offset) > 600)
  )
    return {
      valid: false as const,
      error:
        'Use a signed whole-second offset between −600 and +600, and uncertainty from 0 to 120 seconds.',
    };
  const events = [
    {
      id: 'idp',
      label: 'IdP authentication',
      raw: 0,
      offset: 0,
      corrected: 0,
      uncertainty: 2,
    },
    {
      id: 'database',
      label: 'Database query',
      raw: 260,
      offset: measured ? offset : null,
      corrected: measured ? 260 - offset : null,
      uncertainty: measured ? uncertainty : null,
    },
    {
      id: 'egress',
      label: 'Egress observation',
      raw: 40,
      offset: 0,
      corrected: 40,
      uncertainty: 2,
    },
  ].map((e) => ({
    ...e,
    lower:
      e.corrected === null || e.uncertainty === null
        ? null
        : e.corrected - e.uncertainty,
    upper:
      e.corrected === null || e.uncertainty === null
        ? null
        : e.corrected + e.uncertainty,
  }));
  const known = events.filter((e) => e.lower !== null && e.upper !== null);
  const min =
    Math.floor((Math.min(-2, ...known.map((e) => e.lower!)) - 8) / 10) * 10;
  const max =
    Math.ceil((Math.max(42, ...known.map((e) => e.upper!)) + 8) / 10) * 10;
  const precedence = events.flatMap((a) =>
    events
      .filter(
        (b) =>
          a.id !== b.id &&
          a.upper !== null &&
          b.lower !== null &&
          a.upper < b.lower,
      )
      .map((b) => ({
        from: a.id,
        to: b.id,
        label: `${a.label} before ${b.label}`,
      })),
  );
  return { valid: true as const, events, min, max, precedence, measured };
}
