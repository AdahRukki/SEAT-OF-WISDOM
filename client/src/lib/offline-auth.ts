const OFFLINE_AUTH_KEY = 'sowa_offline_auth';

interface CachedAuthEntry {
  identifier: string;
  passwordHash: string;
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    role: string;
    schoolId?: string;
  };
  cachedAt: number;
}

async function hashForOffline(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'sowa_offline_salt_2025');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function cacheAuthCredentials(
  identifier: string,
  password: string,
  token: string,
  user: CachedAuthEntry['user']
): Promise<void> {
  try {
    const passwordHash = await hashForOffline(password);
    const entries = getStoredEntries();
    const existingIndex = entries.findIndex(e => e.identifier === identifier.toLowerCase());
    const entry: CachedAuthEntry = {
      identifier: identifier.toLowerCase(),
      passwordHash,
      token,
      user,
      cachedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      entries[existingIndex] = entry;
    } else {
      entries.push(entry);
      if (entries.length > 10) entries.shift();
    }

    localStorage.setItem(OFFLINE_AUTH_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Failed to cache offline auth:', e);
  }
}

export async function attemptOfflineLogin(
  identifier: string,
  password: string
): Promise<{ token: string; user: CachedAuthEntry['user'] } | null> {
  try {
    const entries = getStoredEntries();
    const normalizedId = identifier.toLowerCase();
    const entry = entries.find(e => e.identifier === normalizedId);

    if (!entry) return null;

    const maxAge = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - entry.cachedAt > maxAge) {
      removeEntry(normalizedId);
      return null;
    }

    const passwordHash = await hashForOffline(password);
    if (passwordHash !== entry.passwordHash) return null;

    return { token: entry.token, user: entry.user };
  } catch (e) {
    console.warn('Offline auth check failed:', e);
    return null;
  }
}

export function updateCachedToken(identifier: string, newToken: string): void {
  try {
    const entries = getStoredEntries();
    const entry = entries.find(e => e.identifier === identifier.toLowerCase());
    if (entry) {
      entry.token = newToken;
      entry.cachedAt = Date.now();
      localStorage.setItem(OFFLINE_AUTH_KEY, JSON.stringify(entries));
    }
  } catch (e) {
    console.warn('Failed to update cached token:', e);
  }
}

export function updateCachedUser(identifier: string, user: CachedAuthEntry['user']): void {
  try {
    const entries = getStoredEntries();
    const entry = entries.find(e => e.identifier === identifier.toLowerCase());
    if (entry) {
      entry.user = user;
      localStorage.setItem(OFFLINE_AUTH_KEY, JSON.stringify(entries));
    }
  } catch (e) {
    console.warn('Failed to update cached user:', e);
  }
}

export function clearOfflineAuth(): void {
  localStorage.removeItem(OFFLINE_AUTH_KEY);
}

function getStoredEntries(): CachedAuthEntry[] {
  try {
    const raw = localStorage.getItem(OFFLINE_AUTH_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function removeEntry(identifier: string): void {
  const entries = getStoredEntries().filter(e => e.identifier !== identifier);
  localStorage.setItem(OFFLINE_AUTH_KEY, JSON.stringify(entries));
}
