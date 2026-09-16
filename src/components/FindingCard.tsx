import { useTranslations } from "next-intl";
import type { FindingView } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { CategoryBadge } from "@/components/CategoryBadge";

export function FindingCard({ finding }: { finding: FindingView }) {
  const t = useTranslations("Review");
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={finding.severity} />
        <CategoryBadge category={finding.category} />
        <span className="ml-auto font-mono text-xs text-muted">
          {finding.file}
          {finding.line ? `:${finding.line}` : ""}
        </span>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-foreground">{finding.title}</h3>
      <p className="mt-1.5 text-sm text-foreground/90">{finding.description}</p>

      <div className="mt-3 grid gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("whyItMatters")}</p>
          <p className="mt-1 text-foreground/80">{finding.why}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("suggestedFix")}</p>
          <p className="mt-1 text-foreground/80">{finding.suggestion}</p>
        </div>
      </div>
    </div>
  );
}
