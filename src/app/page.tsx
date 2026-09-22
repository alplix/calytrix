import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAthenaUser, athenaLoginUrlForPath } from "@/lib/session";
import { AthenaSignInButton } from "@/components/AuthButtons";
import { Navbar } from "@/components/Navbar";

export default async function Home() {
  const athenaUser = await getAthenaUser();
  if (athenaUser) redirect("/dashboard");

  const t = await getTranslations("Landing");
  const signInHref = await athenaLoginUrlForPath("/dashboard");

  const categories = [
    { key: "categoryBugs", color: "var(--critical)" },
    { key: "categorySecurity", color: "var(--high)" },
    { key: "categoryPerformance", color: "var(--medium)" },
    { key: "categoryCodeQuality", color: "var(--low)" },
    { key: "categoryMissingTests", color: "var(--accent)" },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <span className="mb-5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted">
          {t("badge")}
        </span>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {t("title")}
        </h1>

        <p className="mt-5 max-w-xl text-lg text-muted">{t("subtitle")}</p>

        <div className="mt-8">
          <AthenaSignInButton href={signInHref} />
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-3">
          {categories.map((c) => (
            <span
              key={c.key}
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ color: c.color, backgroundColor: `color-mix(in srgb, ${c.color} 15%, transparent)` }}
            >
              {t(c.key)}
            </span>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        <p>{t("footerTagline")}</p>
        <p className="mt-1">{t("footerCredit")}</p>
      </footer>
    </div>
  );
}
