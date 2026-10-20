// Browser-only. A random per-device id lets a device change its own reaction;
// the first name is a label the visitor typed. Nothing here identifies a person.
const ID_KEY = "rabobank_respondent_id";
const NAME_KEY = "rabobank_first_name";

let memId = "";
let memName = "";
const listeners = new Set<() => void>();

export function getRespondentId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    // Blocked storage: this page load still gets a stable id.
    return (memId ||= crypto.randomUUID());
  }
}

export function getFirstName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return memName;
  }
}

export function setFirstName(name: string): void {
  memName = name;
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // kept in memory
  }
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Stable shuffle: the same device always sees the same order. */
export function seededOrder<T>(items: T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
