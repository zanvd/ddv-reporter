// Generic, domain-agnostic localStorage layer (plan 0002 §5 "storage.js").
//
// Knows nothing about Glava or any other persisted domain — it only knows
// how to namespace a key, wrap/unwrap a small versioned envelope
// ({ version, data }), and reduce every localStorage access to a safe
// result. This is the reusable seam future persisted-data domains share
// (spec 0002 §7 forward-compatibility constraint): each domain gets its own
// key under the `ddvReporter.<domain>` namespace, so domains are
// independently addressable and independently removable, with no shared
// blob to migrate.
//
// Every access (including reading the backend itself, which some browsers'
// private-mode restrictions can throw on) is wrapped in try/catch, so a
// caller never sees an exception — only `null` (read) or `false`
// (write/remove) on any failure (spec §8, §6.6).
//
// No DOM access. The storage backend is injectable (defaults to
// `globalThis.localStorage`) so this module is unit-testable under Node's
// runner without a real localStorage.

const NAMESPACE = 'ddvReporter';

/** Builds the namespaced localStorage key for a given data domain. */
export function keyFor(domain) {
  return `${NAMESPACE}.${domain}`;
}

function resolveBackend(backend) {
  return backend ?? globalThis.localStorage;
}

/**
 * Reads and parses the envelope stored for `domain`.
 *
 * @returns {{version: *, data: object}|null} `null` if nothing is stored,
 *   the backend is unavailable, the stored value is not valid JSON, or the
 *   parsed value is not a `{ data: object }` envelope.
 */
export function readRecord(domain, backend) {
  try {
    const store = resolveBackend(backend);
    const raw = store.getItem(keyFor(domain));
    if (raw == null) return null;

    const envelope = JSON.parse(raw);
    if (
      !envelope
      || typeof envelope !== 'object'
      || typeof envelope.data !== 'object'
      || envelope.data === null
    ) {
      return null;
    }

    return { version: envelope.version, data: envelope.data };
  } catch {
    return null;
  }
}

/**
 * Writes `data` for `domain` wrapped in a `{ version, data }` envelope,
 * overwriting any previously stored record for that domain.
 *
 * @returns {boolean} `true` on success, `false` on any failure (storage
 *   unavailable, quota exceeded, private-mode restrictions).
 */
export function writeRecord(domain, version, data, backend) {
  try {
    const store = resolveBackend(backend);
    store.setItem(keyFor(domain), JSON.stringify({ version, data }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes the stored record for `domain`, if any.
 *
 * @returns {boolean} `true` on success, `false` on any failure.
 */
export function removeRecord(domain, backend) {
  try {
    const store = resolveBackend(backend);
    store.removeItem(keyFor(domain));
    return true;
  } catch {
    return false;
  }
}
