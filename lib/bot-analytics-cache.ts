/**
 * Tiny in-memory caches for the analytics API (per server instance; harmless if a request lands on a cold one).
 *  - the finished payload: 20 s, so a double-open / refresh tap does not repeat ~10 queries
 *  - "bot question number → site question id" per mock: 10 min (it only changes when a mock is re-published)
 */
const PAYLOAD_TTL = 20_000
const MAP_TTL = 10 * 60_000

const payloads = new Map<string, { at: number; body: string }>()
const maps = new Map<string, { at: number; value: Map<string, number> | null }>()

export function getPayload(key: string): string | null {
  const hit = payloads.get(key)
  return hit && Date.now() - hit.at < PAYLOAD_TTL ? hit.body : null
}
export function setPayload(key: string, body: string) {
  payloads.set(key, { at: Date.now(), body })
}
/** Call after archiving / linking, so the next open shows the change at once. */
export function clearPayloads() {
  payloads.clear()
}

export function getQuestionMap(code: string): { value: Map<string, number> | null } | null {
  const hit = maps.get(code)
  return hit && Date.now() - hit.at < MAP_TTL ? { value: hit.value } : null
}
export function setQuestionMap(code: string, value: Map<string, number> | null) {
  maps.set(code, { at: Date.now(), value })
}
