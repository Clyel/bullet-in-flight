// Named snapshots of the whole input form, persisted in the browser so a
// user can come back to a load without re-entering every field. No physics,
// no React — just get/save/delete against localStorage.

const STORAGE_KEY = "bullet-in-flight:savedLoads";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(loads) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loads));
  } catch {
    // Storage unavailable (private browsing, quota, etc.) — save silently no-ops.
  }
}

/** All saved loads, alphabetical by name. */
export function listSavedLoads() {
  return readAll().sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Saves formState under name, overwriting any existing load with the same
 * name. formState is the whole form's field set (ammo + rifle + conditions).
 */
export function saveLoad(name, formState) {
  const loads = readAll();
  const existing = loads.find((l) => l.name === name);
  const entry = {
    id: existing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    savedAt: new Date().toISOString(),
    ...formState,
  };
  const next = existing
    ? loads.map((l) => (l.id === existing.id ? entry : l))
    : [...loads, entry];
  writeAll(next);
  return entry;
}

export function deleteLoad(id) {
  writeAll(readAll().filter((l) => l.id !== id));
}
