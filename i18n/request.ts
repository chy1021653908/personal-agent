import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isAppLocale } from "@/i18n/config";

export default getRequestConfig(async () => {
  const localeCookie = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale =
    localeCookie && isAppLocale(localeCookie) ? localeCookie : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
