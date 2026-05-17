import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_CONFIG = {
  N: 16_384,
  r: 16,
  p: 1,
  dkLen: 64,
};

export async function hashBetterAuthPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await generateKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyBetterAuthPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  const [salt, expectedHex] = hash.split(":");
  if (!salt || !expectedHex) {
    throw new Error("Invalid password hash");
  }

  const expected = Buffer.from(expectedHex, "hex");
  const actual = await generateKey(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function generateKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      SCRYPT_CONFIG.dkLen,
      {
        N: SCRYPT_CONFIG.N,
        r: SCRYPT_CONFIG.r,
        p: SCRYPT_CONFIG.p,
        maxmem: 128 * SCRYPT_CONFIG.N * SCRYPT_CONFIG.r * 2,
      },
      (error, key) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(key);
      },
    );
  });
}
