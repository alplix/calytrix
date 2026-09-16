import { getTranslations } from "next-intl/server";
import type { ErrorCode } from "@/lib/errors";

export async function ErrorPanel({ code }: { code: ErrorCode | "UNKNOWN" }) {
  const t = await getTranslations("Errors");

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mx-auto max-w-md rounded-lg border border-border bg-surface p-6">
        <p className="text-sm font-medium text-critical">{t("title")}</p>
        <p className="mt-2 text-sm text-muted">{t(code)}</p>
      </div>
    </div>
  );
}
