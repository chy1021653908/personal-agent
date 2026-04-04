"use client";

import { useTransition } from "react";
import { Check, Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { locales, type AppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LanguageSwitcherProps {
  className?: string;
  iconOnly?: boolean;
}

function getLocaleLabel(t: ReturnType<typeof useTranslations>, locale: string) {
  return locale === "en" ? t("common.language.en") : t("common.language.zh");
}

export function LanguageSwitcher({
  className,
  iconOnly = false,
}: LanguageSwitcherProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const changeLocale = async (nextLocale: AppLocale) => {
    if (nextLocale === locale || isPending) {
      return;
    }

    const res = await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: nextLocale }),
    });

    if (!res.ok) {
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  };

  const currentLabel = getLocaleLabel(t, locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={iconOnly ? "icon" : "sm"}
          className={cn(iconOnly ? "size-8" : "h-8 justify-start gap-2", className)}
          aria-label={t("common.language.switch")}
          disabled={isPending}
        >
          <Languages className="size-4" />
          {!iconOnly ? <span>{currentLabel}</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((option) => {
          const isActive = option === locale;

          return (
            <DropdownMenuItem
              key={option}
              onClick={() => void changeLocale(option)}
              disabled={isPending}
            >
              <span>{getLocaleLabel(t, option)}</span>
              {isActive ? <Check className="ml-auto size-4" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
