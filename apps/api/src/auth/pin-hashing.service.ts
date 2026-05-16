import { Injectable } from "@nestjs/common";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

@Injectable()
export class PinHashingService {
  async hash(pin: string): Promise<string> {
    const salt = randomBytes(16).toString("base64url");
    const derived = (await scrypt(pin, salt, KEY_LENGTH)) as Buffer;
    return `scrypt:${salt}:${derived.toString("base64url")}`;
  }

  async verify(pin: string, hash: string): Promise<boolean> {
    const [scheme, salt, stored] = hash.split(":");
    if (scheme !== "scrypt" || !salt || !stored) {
      return false;
    }

    const derived = (await scrypt(pin, salt, KEY_LENGTH)) as Buffer;
    const storedBuffer = Buffer.from(stored, "base64url");
    return (
      storedBuffer.length === derived.length &&
      timingSafeEqual(storedBuffer, derived)
    );
  }
}
