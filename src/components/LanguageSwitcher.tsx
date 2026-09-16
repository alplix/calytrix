"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { locales, localeLabels } from "@/i18n/config";
import { setLocaleAction } from "@/lib/actions";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("Language");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      aria-label={t("label")}
      value={locale}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          await setLocaleAction(next);
          router.refresh();
        });
      }}
      className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-muted disabled:opacity-50"
    >
      {locales.map((code) => (
        <option key={code} value={code}>
          {localeLabels[code]}
        </option>
      ))}
    </select>
  );
}
