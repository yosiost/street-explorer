import type { WalkedLog } from '../kids/walked';

// "Streets we walked", per browser (it doesn't sync between devices).
const KEY = 'street-explorer:walked';

export function loadWalked(): WalkedLog {
  try {
    const log = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    return log && typeof log === 'object' && !Array.isArray(log) ? (log as WalkedLog) : {};
  } catch {
    return {};
  }
}

export function saveWalked(log: WalkedLog): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    // Storage blocked (private mode): the walks last for this visit only.
  }
}
