/**
 * File-backed user store. Single JSON file at `$MIANAN_DATA/users.json`.
 * Schema is `{ version, users: User[] }`. Lookups are O(n) — fine for v1's
 * expected scale (<1000 users). Migrate to SQLite if/when that hurts.
 *
 * Writes are atomic via tmp-file + rename so a crash mid-write can't corrupt
 * the file (important for credentials).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type User = {
  id: string;
  email: string;          // canonical lowercased
  passwordHash: string;
  displayName: string;
  createdAt: string;
  passwordResetTokenHash?: string;   // sha256 hex of the reset token (never store plaintext)
  passwordResetExpiresAt?: string;   // ISO timestamp
};

type Store = {
  version: 1;
  users: User[];
};

function dataDir(): string {
  const fromEnv = process.env.MIANAN_DATA;
  if (fromEnv) return fromEnv;
  if (existsSync("/var/lib/mianan")) return "/var/lib/mianan";
  return join(process.cwd(), "data");
}

function storePath(): string {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "users.json");
}

function load(): Store {
  const p = storePath();
  if (!existsSync(p)) return { version: 1, users: [] };
  try {
    const raw = readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as Store;
    if (!parsed.users) return { version: 1, users: [] };
    return parsed;
  } catch {
    return { version: 1, users: [] };
  }
}

function save(s: Store): void {
  const p = storePath();
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2), { mode: 0o600 });
  renameSync(tmp, p);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findUserByEmail(email: string): User | null {
  const key = normalizeEmail(email);
  return load().users.find((u) => u.email === key) ?? null;
}

export function findUserById(id: string): User | null {
  return load().users.find((u) => u.id === id) ?? null;
}

export function createUser(input: {
  email: string;
  passwordHash: string;
  displayName: string;
}): User {
  const email = normalizeEmail(input.email);
  const s = load();
  if (s.users.some((u) => u.email === email)) {
    throw new Error("EMAIL_EXISTS");
  }
  const user: User = {
    id: randomUUID(),
    email,
    passwordHash: input.passwordHash,
    displayName: input.displayName,
    createdAt: new Date().toISOString(),
  };
  s.users.push(user);
  save(s);
  return user;
}

/**
 * Apply a partial update to a user record atomically. Returns the new user,
 * or null if the user doesn't exist.
 */
export function updateUser(id: string, patch: Partial<User>): User | null {
  const s = load();
  const idx = s.users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  const updated: User = { ...s.users[idx], ...patch };
  s.users[idx] = updated;
  save(s);
  return updated;
}

/** Look up a user by the *hash* of a reset token. Returns null if unknown or expired. */
export function findUserByResetTokenHash(tokenHash: string): User | null {
  const s = load();
  for (const u of s.users) {
    if (u.passwordResetTokenHash === tokenHash) {
      if (u.passwordResetExpiresAt && new Date(u.passwordResetExpiresAt).getTime() > Date.now()) {
        return u;
      }
      return null;
    }
  }
  return null;
}

/** Strip sensitive fields before sending to the client. */
export function publicUser(u: User): Pick<User, "id" | "email" | "displayName" | "createdAt"> {
  return { id: u.id, email: u.email, displayName: u.displayName, createdAt: u.createdAt };
}
