import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator("input[autocomplete=current-password]").fill("knowledge");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/dashboard/);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: /Mensah|Boateng|Asante/ }).first().click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/login/);
}

test("eleven school office journeys", async ({ page }) => {
  const stamp = Date.now();
  const lastName = `Applicant${stamp}`;

  await signIn(page, "ama.mensah@goldenchild.example");
  await page.goto("/admissions/new");
  await page.getByLabel("First name").fill("Ama");
  await page.getByLabel("Last name").fill(lastName);
  await page.locator("input[name=dateOfBirth]").fill("2018-04-04");
  await page.getByLabel("Guardian name").fill("Esi Applicant");
  await page.getByLabel("Guardian phone").fill("0244110099");
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByText("APP-")).toBeVisible();
  const applicationUrl = page.url();

  await page.locator("select[name=outcome]").selectOption("accepted");
  await page.locator("input[name=reason]").fill("Meets the admission requirement");
  await page.getByRole("button", { name: "Record decision" }).click();
  await page.getByRole("button", { name: "Issue admission invoice" }).click();
  await expect(page.getByText("INV-")).toBeVisible();

  await signOut(page);
  await signIn(page, "kwame.boateng@goldenchild.example");
  await page.goto(applicationUrl);
  await page.locator("input[name=amount]").fill("500");
  await page.locator("input[name=reference]").fill("MOMO-100");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/RCT-/)).toBeVisible();
  await expect(page.getByRole("link", { name: "PDF" }).first()).toBeVisible();

  await signOut(page);
  await signIn(page, "ama.mensah@goldenchild.example");
  await page.goto(applicationUrl);
  await page.getByRole("button", { name: "Enroll student" }).click();
  await page.getByRole("link", { name: "Open student record" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(lastName) })).toBeVisible();

  await page.goto("/students");
  await page.getByLabel("Search students").fill(lastName);
  await expect(page.getByText(lastName)).toBeVisible();

  await page.goto("/staff");
  const efua = page.getByRole("row", { name: /Efua Asante/ });
  await expect(efua).toContainText("Basic 4");
  await efua.getByRole("button", { name: "Assign role" }).click();
  await page.getByRole("button", { name: "Save assignment" }).click();
  await expect(page.getByRole("row", { name: /Efua Asante/ })).toContainText("English Language");

  await signOut(page);
  await signIn(page, "efua.asante@goldenchild.example");
  await page.goto("/fees");
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/academics/marks");
  await page.getByLabel("Mark sheet").selectOption({ label: "Basic 4 · Mathematics" });
  const submit = page.getByRole("button", { name: "Submit for review" });
  if (await submit.isEnabled()) {
    const marks = page.locator("input[data-mark]");
    const markCount = await marks.count();
    for (let index = 0; index < markCount; index += 1) {
      const cell = marks.nth(index);
      if ((await cell.inputValue()) === "") await cell.fill("8");
    }
    await submit.click();
    await expect(page.getByText("Submitted for review.")).toBeVisible();
  } else {
    await expect(page.getByText(/cannot be edited/i)).toBeVisible();
  }

  await signOut(page);
  await signIn(page, "ama.mensah@goldenchild.example");
  await page.goto("/academics/review");
  const review = page.getByLabel("Mark sheet");
  const options = await review.locator("option").allTextContents();
  if (options.some((label) => label.includes("Basic 4 · Mathematics · Awaiting review"))) {
    await review.selectOption({ label: "Basic 4 · Mathematics · Awaiting review" });
    await page.getByRole("button", { name: "Approve results" }).click();
    await expect(page.getByText("Results approved. They are not published yet.")).toBeVisible();
  } else if (options.some((label) => label.includes("Basic 4 · Mathematics · Approved"))) {
    await review.selectOption({ label: "Basic 4 · Mathematics · Approved" });
    await expect(page.getByText("Every student has a mark in each component.")).toBeVisible();
  }

  await page.goto("/report-cards");
  await page.getByLabel("Class").selectOption({ label: "Basic 4" });
  const adwoa = page.getByRole("row", { name: /Adwoa Nyarko/ });
  await expect(adwoa).toContainText(/Approved|Published/);
  const publish = adwoa.getByRole("button", { name: "Publish" });
  if (await publish.count()) {
    await publish.click();
    await expect(page.getByText(/Report card published\.|Approve the mark sheet before publishing it\./)).toBeVisible();
  }
  await adwoa.getByRole("link", { name: "Preview" }).click();
  await expect(page.getByRole("heading", { name: "Mathematics" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();

  await page.goto("/audit");
  await expect(page.getByText("student.enrolled").first()).toBeVisible();
  await expect(page.getByText("payment.recorded").first()).toBeVisible();
  await expect(page.getByText("results.published").first()).toBeVisible();
});
