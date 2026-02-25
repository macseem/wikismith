export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class IngestionError extends AppError {
  constructor(message: string, code: string, statusCode = 400, details?: Record<string, unknown>) {
    super(message, code, statusCode, details);
    this.name = 'IngestionError';
  }
}

export class AnalysisError extends AppError {
  constructor(message: string, code: string, statusCode = 500, details?: Record<string, unknown>) {
    super(message, code, statusCode, details);
    this.name = 'AnalysisError';
  }
}

export class GenerationError extends AppError {
  constructor(message: string, code: string, statusCode = 500, details?: Record<string, unknown>) {
    super(message, code, statusCode, details);
    this.name = 'GenerationError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, code: string, statusCode = 429, details?: Record<string, unknown>) {
    super(message, code, statusCode, details);
    this.name = 'RateLimitError';
  }
}
