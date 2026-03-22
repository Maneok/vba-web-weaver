/**
 * Basic error tracking — captures uncaught errors and unhandled rejections.
 * Future: forward to Sentry or a DB errors table.
 */

let _initialized = false;

export function initErrorTracking() {
  if (_initialized) return;
  _initialized = true;

  window.addEventListener('error', (event) => {
    console.error('[GRIMY Error]', event.message, event.filename, event.lineno);
    // Future: envoyer à Sentry ou table errors en DB
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[GRIMY Unhandled Promise]', event.reason);
  });
}
