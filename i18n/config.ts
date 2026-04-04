export const locales = ["zh", "en"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "zh";

export function isAppLocale(locale: string): locale is AppLocale {
  return locales.includes(locale as AppLocale);
}
