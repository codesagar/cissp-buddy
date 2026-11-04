export function denominatorModel(
  patchedInput: string,
  unpatchedInput: string,
  scope: 'known' | 'census',
  censusKnown = true,
) {
  const p = Number(patchedInput),
    u = Number(unpatchedInput);
  if (
    !patchedInput.trim() ||
    !unpatchedInput.trim() ||
    !Number.isInteger(p) ||
    !Number.isInteger(u) ||
    p < 0 ||
    u < 0 ||
    p + u > 20
  )
    return {
      valid: false as const,
      error:
        'Enter whole asset counts from 0 to 20. Together they cannot exceed the 20 initially unknown assets.',
    };
  const patched = 98 + p,
    unpatched = 2 + u,
    unknown = 20 - p - u,
    total = 120;
  const denominator = scope === 'known' ? patched + unpatched : total;
  return {
    valid: true as const,
    patched,
    unpatched,
    unknown,
    total,
    denominator,
    numerator: patched,
    rate: (100 * patched) / denominator,
    lower: censusKnown ? (100 * patched) / total : null,
    upper: censusKnown ? (100 * (patched + unknown)) / total : null,
  };
}
export type PolicyFact = 'yes' | 'no' | 'unknown';
export function authorizationModel(assignment: PolicyFact, device: PolicyFact) {
  const missing = assignment === 'unknown' || device === 'unknown';
  const permit = assignment === 'yes' && device === 'yes';
  return {
    permit,
    decision: permit ? 'Permit' : 'Deny',
    reason: permit
      ? 'Both required conditions are supported by current evidence.'
      : missing
        ? 'A required fact is unknown. This scenario’s policy denies a request that cannot establish both conditions.'
        : 'At least one required condition is false. An authenticated identity does not override that condition.',
  };
}
