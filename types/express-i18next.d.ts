import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    t: (key: string, options?: Record<string, unknown>) => string;
    i18n?: {
      language: string;
      changeLanguage: (lng: string) => Promise<void> | void;
    };
    language?: string;
  }
}


