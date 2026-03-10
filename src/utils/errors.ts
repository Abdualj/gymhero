import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public errorCode?: string
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const catchAsyncError = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const globalErrorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errorCode = 'INTERNAL_SERVER_ERROR';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorCode = err.errorCode || 'APP_ERROR';
  } else if (err instanceof Error) {
    message = err.message;

    // Handle specific error types
    if (err.message.includes('UNIQUE constraint failed')) {
      statusCode = 400;
      message = 'This email or username is already registered';
      errorCode = 'DUPLICATE_ENTRY';
    } else if (err.message.includes('FOREIGN KEY constraint failed')) {
      statusCode = 400;
      message = 'Invalid reference to user or workout';
      errorCode = 'INVALID_REFERENCE';
    } else if (err.message.includes('database is locked')) {
      statusCode = 503;
      message = 'Database is temporarily locked. Please try again later.';
      errorCode = 'DATABASE_LOCKED';
    } else if (err.message.includes('no such table')) {
      statusCode = 500;
      message = 'Database table not found. Please contact support.';
      errorCode = 'TABLE_NOT_FOUND';
    }
  }

  console.error(`[${errorCode}] ${statusCode} - ${message}`, err);

  res.status(statusCode).json({
    error: message,
    errorCode,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const validateRequest = (
  schema: any
): ((req: Request, res: Response, next: NextFunction) => void) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      const message = error.details.map((d: any) => d.message).join(', ');
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }

    req.body = value;
    next();
  };
};
