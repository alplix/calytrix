import { getTranslations } from "next-intl/server";
import { ConnectGithubButton } from "@/components/AuthButtons";

/**
 * Shown on any dashboard page when the visitor has an Athena identity but has
 * not yet authorized GitHub access. No repo/PR calls are made in this state.
 */
export async function ConnectGithubPanel() {
  const t = await getTranslations("ConnectGithub");

  return (
    <div className="mx-auto max-w-6xl px-4 py-20 text-center">
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("subtitle")}</p>
      <div className="mt-6 flex justify-center">
        <ConnectGithubButton />
      </div>
    </div>
  );
}
