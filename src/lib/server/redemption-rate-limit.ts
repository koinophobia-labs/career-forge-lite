export type RedemptionRateState = {
  windowStartedAt: number;
  failures: number;
  strikes: number;
  cooldownUntil: number;
};

export const REDEMPTION_FAILURES_PER_MINUTE = 5;
const WINDOW_MS = 60_000;
const MAX_COOLDOWN_MS = 15 * 60_000;

export function emptyRedemptionRateState(now: number): RedemptionRateState {
  return { windowStartedAt: now, failures: 0, strikes: 0, cooldownUntil: 0 };
}

export function rateLimitBlocked(state: RedemptionRateState | null, now: number): boolean {
  return Boolean(state && state.cooldownUntil > now);
}

export function recordRedemptionFailure(
  prior: RedemptionRateState | null,
  now: number
): RedemptionRateState {
  const state = prior ? { ...prior } : emptyRedemptionRateState(now);
  if (now - state.windowStartedAt >= WINDOW_MS) {
    state.windowStartedAt = now;
    state.failures = 0;
  }
  state.failures += 1;
  if (state.failures >= REDEMPTION_FAILURES_PER_MINUTE) {
    state.strikes += 1;
    state.failures = 0;
    state.windowStartedAt = now;
    state.cooldownUntil = now + Math.min(WINDOW_MS * 2 ** (state.strikes - 1), MAX_COOLDOWN_MS);
  }
  return state;
}

export function clearRedemptionFailures(now: number): RedemptionRateState {
  return emptyRedemptionRateState(now);
}
