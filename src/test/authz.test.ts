import { describe, expect, it } from "vitest";
import { getDeniedMessage, getHomeRouteForRole } from "@/lib/authz";

describe("authz helpers", () => {
  it("returns the correct home route for each role", () => {
    expect(getHomeRouteForRole("admin")).toBe("/admin");
    expect(getHomeRouteForRole("conductor")).toBe("/conductor");
  });

  it("builds a clear access denied message for admin-only routes", () => {
    expect(getDeniedMessage("admin", "conductor")).toContain("administradores");
  });
});
