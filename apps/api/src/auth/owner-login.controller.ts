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
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsEmail, IsString, Matches, MinLength } from "class-validator";
import type { Request } from "express";
import { AuthService, type TokenPair } from "./auth.service";
import { RateLimitService } from "./rate-limit.service";

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";

class OwnerLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  businessSlug!: string;
}

@ApiTags("Auth")
@Controller("auth/owner")
export class OwnerLoginController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(RateLimitService) private readonly rateLimitService: RateLimitService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Owner or manager email/password login" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["email", "password", "businessSlug"],
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 8 },
        businessSlug: { type: "string", example: "cafe-atlas" },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Access and refresh tokens issued.",
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
  @ApiResponse({ status: 401, description: "Invalid credentials." })
  @ApiResponse({ status: 429, description: "Too many login attempts." })
  async login(
    @Body() body: OwnerLoginDto,
    @Req() request: Request,
    @Headers("x-forwarded-for") forwardedFor?: string,
  ): Promise<TokenPair> {
    const ip = this.clientIp(request, forwardedFor);
    const rateKey = `${ip}:${body.businessSlug}`;
    const rateLimit = await this.rateLimitService.checkPinAttempt(rateKey);

    if (!rateLimit.allowed) {
      throw new HttpException(
        {
          type: `${PROBLEM_BASE_URL}/rate-limit-exceeded`,
          message: "Too many login attempts. Try again later.",
          retry_after_seconds: rateLimit.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      const result = await this.authService.issueOwnerPasswordToken(body);
      await this.rateLimitService.clearPinAttempts(rateKey);
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw error;
    }
  }

  private clientIp(request: Request, forwardedFor?: string): string {
    const forwarded = forwardedFor?.split(",")[0]?.trim();
    return forwarded || request.ip || "unknown";
  }
}
