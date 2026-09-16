import type { FindingCategory } from "@prisma/client";
import { useTranslations } from "next-intl";

export function CategoryBadge({ category }: { category: FindingCategory }) {
  const t = useTranslations("Category");
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted">
      {t(category)}
    </span>
  );
}
