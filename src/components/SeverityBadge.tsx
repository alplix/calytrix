import type { Severity } from "@prisma/client";
import { useTranslations } from "next-intl";

const SEVERITY_COLOR_VAR: Record<Severity, string> = {
  CRITICAL: "var(--critical)",
  HIGH: "var(--high)",
  MEDIUM: "var(--medium)",
  LOW: "var(--low)",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const t = useTranslations("Severity");
  const color = SEVERITY_COLOR_VAR[severity];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {t(severity)}
    </span>
  );
}
