import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import type { Request } from "express";
import { AuthService, type TokenPair } from "./auth.service";
import { ApiJwtService } from "./jwt.strategy";
import { RateLimitService } from "./rate-limit.service";

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";

class RefreshTokenDto {
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}

@ApiTags("Auth")
@Controller("auth")
export class RefreshController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ApiJwtService) private readonly jwtService: ApiJwtService,
    @Inject(RateLimitService) private readonly rateLimitService: RateLimitService,
  ) {}

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate a refresh token and issue a new token pair" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["refreshToken"],
      properties: {
        refreshToken: { type: "string" },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "New access and refresh tokens issued.",
    schema: {
      type: "object",
      required: ["accessToken", "refreshToken", "tokenType", "expiresIn"],
      properties: {
        accessToken: { type: "string" },
        refreshToken: { type: "string" },
        tokenType: { type: "string", enum: ["Bearer"] },
        expiresIn: { type: "number", example: 900 },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Refresh token is invalid." })
  @ApiResponse({ status: 429, description: "Too many refresh attempts." })
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() request: Request,
    @Headers("x-forwarded-for") forwardedFor?: string,
    @Headers("x-tenant-id") tenantHeader?: string,
  ): Promise<TokenPair> {
    const ip = this.clientIp(request, forwardedFor);
    const tokenHash = this.jwtService.hashOpaqueToken(body.refreshToken);
    const rateLimit = await this.rateLimitService.checkFixedWindow(
      "auth-refresh",
      `${ip}:${tokenHash.slice(0, 32)}`,
      10,
      5 * 60,
    );

    if (!rateLimit.allowed) {
      throw new HttpException(
        {
          type: `${PROBLEM_BASE_URL}/rate-limit-exceeded`,
          message: "Too many refresh attempts. Try again later.",
          retry_after_seconds: rateLimit.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.authService.refreshToken({
      refreshToken: body.refreshToken,
      expectedBusinessId: tenantHeader,
    });
  }

  private clientIp(request: Request, forwardedFor?: string): string {
    const forwarded = forwardedFor?.split(",")[0]?.trim();
    return forwarded || request.ip || "unknown";
  }
}
