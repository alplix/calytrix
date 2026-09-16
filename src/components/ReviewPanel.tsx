"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { ReviewView } from "@/lib/types";
import { FindingCard } from "@/components/FindingCard";
import { sortBySeverity, timeAgo } from "@/lib/format";

export type ReviewViewData = ReviewView;

export function ReviewPanel({
  owner,
  repo,
  number,
  initialReview,
}: {
  owner: string;
  repo: string;
  number: number;
  initialReview: ReviewViewData | null;
}) {
  const [review, setReview] = useState(initialReview);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Review");
  const tErrors = useTranslations("Errors");

  async function runReview(force: boolean) {
    setLoading(true);
    setErrorCode(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, number, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorCode(data.code ?? "UNKNOWN");
        return;
      }
      setReview(data.review);
      router.refresh();
    } catch {
      setErrorCode("NETWORK_ERROR");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {review ? (
            <p className="text-sm text-muted">
              {t("lastReviewedAt", { time: timeAgo(review.createdAt, locale) })} ·{" "}
              {t("summaryCount", { count: review.findings.length })}
            </p>
          ) : (
            <p className="text-sm text-muted">{t("notReviewed")}</p>
          )}
        </div>

        <button
          onClick={() => runReview(!!review)}
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? t("running") : review ? t("rerun") : t("run")}
        </button>
      </div>

      {errorCode && <p className="mt-3 text-sm text-critical">{tErrors(errorCode)}</p>}

      {review && (
        <div className="mt-6 flex flex-col gap-3">
          {review.findings.length === 0 ? (
            <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
              {t("noProblems")}
            </p>
          ) : (
            sortBySeverity(review.findings).map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
