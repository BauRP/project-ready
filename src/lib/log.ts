// Production mode log sanitization
// In production builds, all console output is suppressed.

const IS_PRODUCTION = import.meta.env.PROD;

export function initProductionMode() {
  if (!IS_PRODUCTION) return;

  const noop = () => {};
  console.log = noop;
  console.debug = noop;
  console.warn = noop;
  console.info = noop;
  // Keep console.error for critical failures
}
