export const EXIT_DURATION = 140

export function getExitDuration() {
  return globalThis.CSS?.supports?.('animation-timing-function', 'linear(0, 1)') &&
    !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? EXIT_DURATION
    : 0
}
