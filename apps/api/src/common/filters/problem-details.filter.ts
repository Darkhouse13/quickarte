import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";

type ValidationErrorDetail = {
  field: string;
  message: string;
};

type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  request_id?: string;
  errors?: ValidationErrorDetail[];
  [extension: string]: unknown;
};

type RequestWithId = Request & { id?: string };

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status = this.getStatus(exception);
    const problem = this.toProblem(exception, status, request);

    response
      .status(status)
      .type("application/problem+json")
      .json(problem);
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private toProblem(
    exception: unknown,
    status: number,
    request: RequestWithId,
  ): ProblemDetails {
    const title = this.getTitle(exception, status);
    const validationErrors = this.getValidationErrors(exception);

    return {
      type: this.getType(exception, status, validationErrors.length > 0),
      title,
      status,
      detail: this.getDetail(exception, title),
      instance: request.originalUrl ?? request.url,
      request_id: request.id,
      ...(validationErrors.length > 0 ? { errors: validationErrors } : {}),
      ...this.getExtensions(exception),
    };
  }

  private getTitle(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === "object" && response && "error" in response) {
        return String(response.error);
      }
    }

    return (
      HttpStatus[status]
        ?.toString()
        .toLowerCase()
        .replaceAll("_", " ") ?? "internal server error"
    );
  }

  private getDetail(exception: unknown, fallback: string): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === "string") {
        return response;
      }

      if (typeof response === "object" && response && "message" in response) {
        const message = response.message;
        return Array.isArray(message) ? message.join("; ") : String(message);
      }

      return exception.message;
    }

    return exception instanceof Error ? exception.message : fallback;
  }

  private getType(
    exception: unknown,
    status: number,
    hasValidationErrors: boolean,
  ): string {
    if (hasValidationErrors || exception instanceof BadRequestException) {
      return `${PROBLEM_BASE_URL}/validation-failed`;
    }

    if (status === HttpStatus.NOT_FOUND) {
      return `${PROBLEM_BASE_URL}/not-found`;
    }

    if (status >= 500) {
      return `${PROBLEM_BASE_URL}/internal-server-error`;
    }

    return `${PROBLEM_BASE_URL}/http-error`;
  }

  private getValidationErrors(exception: unknown): ValidationErrorDetail[] {
    if (!(exception instanceof BadRequestException)) {
      return [];
    }

    const response = exception.getResponse();
    if (typeof response !== "object" || !response || !("message" in response)) {
      return [];
    }

    const message = response.message;
    if (!Array.isArray(message)) {
      return [];
    }

    return message.map((entry) => {
      const [field, ...rest] = String(entry).split(" ");
      return {
        field: field || "request",
        message: rest.length > 0 ? rest.join(" ") : String(entry),
      };
    });
  }

  private getExtensions(exception: unknown): Record<string, unknown> {
    if (!(exception instanceof HttpException)) {
      return {};
    }

    const response = exception.getResponse();
    if (typeof response !== "object" || !response) {
      return {};
    }

    const extensions: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(response)) {
      if (["error", "message", "statusCode"].includes(key)) {
        continue;
      }
      extensions[key] = value;
    }

    return extensions;
  }
}
