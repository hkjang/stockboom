export const locales = ['ko', 'en'] as const;
export const defaultLocale = 'ko';

export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
    ko: '한국어',
    en: 'English',
};
