import {handle} from '../core/api.mjs';

export const portable = true;

// A portable demo belongs to this browser tab. No requests leave the device.
const storageKey = 'vektor-demo-v3:' + location.pathname;
let saved = {session: '', workspaces: {}};
try {
  const stored = sessionStorage.getItem(storageKey);
  if (stored) saved = JSON.parse(stored);
} catch {
  // A browser may disable storage for a downloaded file. Memory still works.
}
function persist() {
  try { sessionStorage.setItem(storageKey, JSON.stringify(saved)); } catch {}
}
const storage = {
  get(id) { return saved.workspaces[id]; },
  add(id, state) {
    if (!saved.workspaces[id]) saved.workspaces[id] = {revision: 0, payload: JSON.stringify(state)};
    persist();
  },
  put(id, revision, state) {
    if (saved.workspaces[id]?.revision !== revision) return false;
    saved.workspaces[id] = {revision: revision + 1, payload: JSON.stringify(state)};
    persist();
    return true;
  }
};

export async function request(path, body) {
  const headers = new Headers();
  if (body !== undefined) headers.set('content-type', 'application/json');
  const input = new Request('https://vektor.invalid/api/v1/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers
  });
  const localSession = {value: saved.session};
  const response = await handle(input, storage, {mode: 'demo', localSession});
  if (saved.session !== localSession.value) {
    saved.session = localSession.value;
    persist();
  }
  return response;
}
