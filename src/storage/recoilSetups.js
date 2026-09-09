// Recoil setups, persisted so a comparison list survives a reload — same
// storage shape/pattern as savedLoads.js, but insert-only: unlike a named
// "saved dataset," adding a setup never overwrites an existing one by name
// (the whole point of the Recoil tab is a running list to compare, not a
// single named slot per cartridge).

const STORAGE_KEY = "bullet-in-flight:recoilSetups";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(setups) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setups));
  } catch {
    // Storage unavailable (private browsing, quota, etc.) — save silently no-ops.
  }
}

/** All recoil setups, in the order they were added. */
export function listRecoilSetups() {
  return readAll();
}

/** Always inserts a new setup — never overwrites an existing one by name. */
export function addRecoilSetup(setup) {
  const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...setup };
  writeAll([...readAll(), entry]);
  return entry;
}

export function deleteRecoilSetup(id) {
  writeAll(readAll().filter((s) => s.id !== id));
}
