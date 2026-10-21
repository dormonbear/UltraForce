interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

// Arguments can contain session values, SOQL, org hosts or record content.
// Apply the same privacy boundary to development and production builds.
const ignore = (..._args: unknown[]): void => {}

export const logger: Logger = {
  debug: ignore,
  info: ignore,
  warn: ignore,
  error: (..._args: unknown[]) => {
    console.error('[UltraForce] An operation failed.')
  }
}
