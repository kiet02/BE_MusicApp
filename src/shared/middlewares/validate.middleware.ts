import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { BadRequestError } from '@shared/utils/api-error';

type ValidationSource = 'body' | 'params' | 'query';

interface ValidationSchema {
  body?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
}

export const validate = (schema: ValidationSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    let firstError: Record<string, string> | null = null;

    const sources: ValidationSource[] = ['body', 'params', 'query'];

    for (const source of sources) {
      if (schema[source]) {
        const parsed = schema[source]!.safeParse(req[source]);

        if (!parsed.success) {
          if (!firstError) {
            const detail = parsed.error.issues[0];
            const rawMessage = detail.message;
            const hasCustomCode = rawMessage.includes('|');

            firstError = {
              code: hasCustomCode ? rawMessage.split('|')[0] : detail.code.toUpperCase(),
              message: hasCustomCode ? rawMessage.split('|')[1] : rawMessage,
            };
          }
          // Do not break here if you want to keep req[source] un-mutated or simply break.
          // Since we already found an error, we can just break entirely.
          break;
        } else {
          req[source] = parsed.data;
        }
      }
    }

    if (firstError) {
      next(new BadRequestError('API|VALIDATION_FAILED', firstError));
      return;
    }
    next();
  };
};
