const UNIT_MS = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

type DurationUnit = keyof typeof UNIT_MS;

function isDurationUnit(value: string): value is DurationUnit {
  return value in UNIT_MS;
}

/** Parses simple duration strings like "15m", "7d", "500ms" into milliseconds. */
export function parseDurationMs(input: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(input.trim());
  if (!match) {
    throw new Error(
      `Invalid duration string: "${input}" (expected e.g. "15m", "7d")`,
    );
  }
  const value = match[1];
  const unit = match[2];
  if (!value || !unit || !isDurationUnit(unit)) {
    throw new Error(
      `Invalid duration string: "${input}" (expected e.g. "15m", "7d")`,
    );
  }
  return Number(value) * UNIT_MS[unit];
}
