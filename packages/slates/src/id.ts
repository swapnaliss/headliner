import { randomBytes } from "node:crypto";

/** Shareable slates live 30 days (ADR 0003). */
export const SLATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const ALPHABET = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

/** 21 URL-safe characters from the CSPRNG (the nanoid(21) format; 64 symbols so no modulo bias). */
export function newSlateId(): string {
  const bytes = randomBytes(21);
  let id = "";
  for (const b of bytes) id += ALPHABET[b & 63];
  return id;
}

/** True for the 21-character nanoid-alphabet ids `newSlateId` produces. Checked before any lookup. */
export function isSlateId(value: string): boolean {
  return /^[A-Za-z0-9_-]{21}$/.test(value);
}
