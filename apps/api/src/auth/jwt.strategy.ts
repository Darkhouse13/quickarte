import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";

export type ApiAccessClaims = {
  sub: string;
  business_id: string;
  role_id: string;
  permissions_version: number;
  is_platform_admin: false;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
};

type SignInput = Omit<ApiAccessClaims, "iat" | "exp" | "iss" | "aud">;

@Injectable()
export class ApiJwtService {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  signAccessToken(input: SignInput): string {
    const now = Math.floor(Date.now() / 1000);
    const claims: ApiAccessClaims = {
      ...input,
      iat: now,
      exp: now + 15 * 60,
      iss: this.configService.getOrThrow<string>("JWT_ISSUER"),
      aud: this.configService.getOrThrow<string>("JWT_AUDIENCE"),
    };

    return this.sign(claims);
  }

  verifyAccessToken(token: string): ApiAccessClaims {
    const [encodedHeader, encodedPayload, signature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !signature) {
      throw this.invalidToken();
    }

    const expected = this.signingInputSignature(`${encodedHeader}.${encodedPayload}`);
    if (!this.safeEqual(signature, expected)) {
      throw this.invalidToken();
    }

    const payload = this.parsePayload(encodedPayload);
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp <= now) {
      throw new UnauthorizedException({
        type: `${PROBLEM_BASE_URL}/auth-token-expired`,
        message: "Access token is expired.",
      });
    }

    if (
      payload.iss !== this.configService.getOrThrow<string>("JWT_ISSUER") ||
      payload.aud !== this.configService.getOrThrow<string>("JWT_AUDIENCE")
    ) {
      throw this.invalidToken();
    }

    return payload;
  }

  createRefreshToken(businessId: string): { token: string; tokenHash: string; expiresAt: Date } {
    const token = `${businessId}.${randomBytes(48).toString("base64url")}`;
    return {
      token,
      tokenHash: this.hashOpaqueToken(token),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }

  getRefreshTokenBusinessId(token: string): string | null {
    const [businessId, opaqueSecret] = token.split(".");
    if (!businessId || !opaqueSecret || token.split(".").length !== 2) {
      return null;
    }
    return businessId;
  }

  hashOpaqueToken(token: string): string {
    return createHmac("sha256", this.secret()).update(token).digest("hex");
  }

  private sign(claims: ApiAccessClaims): string {
    const header = this.base64UrlEncode({ alg: "HS256", typ: "JWT" });
    const payload = this.base64UrlEncode(claims);
    const signature = this.signingInputSignature(`${header}.${payload}`);
    return `${header}.${payload}.${signature}`;
  }

  private signingInputSignature(input: string): string {
    return createHmac("sha256", this.secret()).update(input).digest("base64url");
  }

  private secret(): string {
    return this.configService.getOrThrow<string>("JWT_SECRET");
  }

  private base64UrlEncode(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
  }

  private parsePayload(encodedPayload: string): ApiAccessClaims {
    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8"),
      ) as Partial<ApiAccessClaims>;

      if (
        typeof payload.sub !== "string" ||
        typeof payload.business_id !== "string" ||
        typeof payload.role_id !== "string" ||
        typeof payload.permissions_version !== "number" ||
        payload.is_platform_admin !== false ||
        typeof payload.iat !== "number" ||
        typeof payload.exp !== "number" ||
        typeof payload.iss !== "string" ||
        typeof payload.aud !== "string"
      ) {
        throw new Error("Invalid payload shape");
      }

      return payload as ApiAccessClaims;
    } catch {
      throw this.invalidToken();
    }
  }

  private safeEqual(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
  }

  private invalidToken(): UnauthorizedException {
    return new UnauthorizedException({
      type: `${PROBLEM_BASE_URL}/auth-token-invalid`,
      message: "Access token is invalid.",
    });
  }
}
