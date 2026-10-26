import { expect, test } from "@playwright/test";

import { history, routeGarmin, yearOfActivities } from "./helpers.js";

test("opens on this year", async ({ page }) => {
  await routeGarmin(page);
  await page.goto("/");
  await expect(page.getByText("runner")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(
    String(new Date().getFullYear()),
  );
  await expect(page.getByRole("button", { name: "Activities" })).toHaveCount(0);
});

test("sums a year, read across pages", async ({ page }) => {
  await routeGarmin(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Year", exact: true }).click();
  const thisYear = new Date().getFullYear();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(String(thisYear));
  await page.getByRole("button", { name: "Previous year" }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(String(thisYear - 1));
  const count = yearOfActivities(thisYear - 1).length;
  await expect(page.locator(".totals")).toContainText(String(count));
  await expect(page.getByRole("img", { name: /^Jul: / })).toBeVisible();
  await expect(page.getByRole("table", { name: "By sport" })).toContainText("Cycling");
  // The year's training, from the fixtures' heart rate and load: a column per month.
  await expect(page.getByRole("heading", { name: "Training" })).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Intensity per month" }).getByRole("img"),
  ).toHaveCount(12);
  // One measure for the page, both charts follow it; reset to distance after.
  const measures = page.getByRole("group", { name: "Measure" });
  await measures.getByRole("button", { name: "Climb" }).click();
  await expect(page.getByText("Climb per month")).toBeVisible();
  await expect(page.getByText("Climb through the year")).toBeVisible();
  // The tiles say how the year compares with the one before.
  await expect(page.locator(".totals")).toContainText(`vs ${thisYear - 2}`);
  // The type filter narrows the sums to one sport.
  await page
    .getByRole("group", { name: "Activity type" })
    .getByRole("button", { name: "Cycling" })
    .click();
  await expect(page.locator(".totals")).toContainText("12");
  // The view is remembered across a reload.
  await page.reload();
  await expect(page.getByRole("button", { name: "Year", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // So is the type picked.
  await expect(
    page.getByRole("group", { name: "Activity type" }).getByRole("button", { name: "Cycling" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("sums every year since the first, and opens one", async ({ page }) => {
  await routeGarmin(page);
  await page.goto("/");
  await page.getByRole("button", { name: "All time" }).click();
  const thisYear = new Date().getFullYear();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(`${thisYear - 3}–${thisYear}`);
  await expect(page.locator(".totals")).toContainText(String(history().length));
  await expect(page.getByRole("img", { name: new RegExp(`^${thisYear - 2}: `) })).toBeVisible();
  // The training is the year page's, not the history's.
  await expect(page.getByRole("heading", { name: "Training" })).toHaveCount(0);
  const years = page.getByRole("table", { name: "Years" });
  await years.getByRole("button", { name: String(thisYear - 2) }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(String(thisYear - 2));
  await expect(page.locator(".totals")).toContainText(
    String(yearOfActivities(thisYear - 2).length),
  );
  // The history began three years back: there is no year before it.
  await page.getByRole("button", { name: "Previous year" }).click();
  await expect(page.getByRole("button", { name: "Previous year" })).toBeDisabled();
});

test("says where the key goes when the server has none", async ({ page }) => {
  await routeGarmin(page, { status: 503 });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("GARMIN_PERSONAL_API_KEY");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("No API key yet");
});
