import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';
import path from 'path';

// Export the singleton instance and an explicit initializer to avoid passing a Promise to middleware
export const i18n = i18next;

i18n.use(Backend).use(middleware.LanguageDetector);

export async function initI18n(): Promise<void> {
  await i18n.init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr'],

    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
    },

    detection: {
      order: ['header', 'querystring', 'cookie'],
      lookupHeader: 'accept-language',
      lookupQuerystring: 'lng',
      lookupCookie: 'lng',
      caches: false,
      cookieMinutes: 10080,
    },

    ns: ['common', 'auth', 'emails', 'errors', 'performance',
      'chat','account','assignment','audit','insights','product','productionLine'],
    defaultNS: 'common',

    interpolation: {
      escapeValue: false,
    },

    saveMissing: process.env.NODE_ENV === 'development',
  });
}

export const i18nMiddleware = middleware;
export default i18n;