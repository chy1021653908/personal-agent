import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, isAppLocale } from "@/i18n/config";

const oneYearInSeconds = 60 * 60 * 24 * 365;

export async function POST(request: NextRequest) {
  let locale = defaultLocale;

  try {
    const body = (await request.json()) as { locale?: string };
    if (body.locale && isAppLocale(body.locale)) {
      locale = body.locale;
    }
  } catch {
    // Ignore invalid payload and fall back to default locale.
  }

  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set("NEXT_LOCALE", locale, {
    maxAge: oneYearInSeconds,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
