import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code }
    });
  }
  
  if (err.name === 'ZodError') {
    const message = err.errors
      ? err.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
      : 'Validation error';
    return res.status(400).json({
      error: { message, code: 'VALIDATION_ERROR' }
    });
  }

  console.error(err);
  return res.status(500).json({
    error: { message: 'Internal Server Error', code: 'INTERNAL_ERROR' }
  });
};
