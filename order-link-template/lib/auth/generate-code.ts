// Generates a cryptographically random, URL-safe alphanumeric code of fixed length.
// Identical to the activation code logic in project-guochenwei.

import { randomBytes } from "crypto";

const CODE_LENGTH = 8;
// Uppercase letters + digits, no ambiguous characters (0/O, 1/I/l)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generate a cryptographically random 8-character order code.
 * Uses rejection-free sampling: ALPHABET has 32 chars (2^5), so byte % 32 has zero bias.
 *
 * Example output: "A3KX9P2M"
 */
export function generateCode(): string {
  const alphabetLength = ALPHABET.length; // 32 — power of 2, no bias
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % alphabetLength];
  }
  return code;
}
