import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("proxy", () => {
  it("redirects a dashboard visit with no tv cookie at all to Athena sign-in", () => {
    const request = new NextRequest("https://calytrix.athena.org.tr/dashboard/owner/repo");
    const res = proxy(request);

    expect(res).toBeDefined();
    expect(res?.headers.get("location")).toBe(
      "https://athena.org.tr/giris?next=https%3A%2F%2Fcalytrix.athena.org.tr%2Fdashboard%2Fowner%2Frepo"
    );
  });

  it("lets the request through (no redirect) when a tv cookie is present", () => {
    const request = new NextRequest("https://calytrix.athena.org.tr/dashboard", {
      headers: { cookie: "tv=some-cookie-value" },
    });
    const res = proxy(request);
    expect(res).toBeUndefined();
  });

  it("does not touch routes outside /dashboard", () => {
    const request = new NextRequest("https://calytrix.athena.org.tr/");
    const res = proxy(request);
    expect(res).toBeUndefined();
  });
});
