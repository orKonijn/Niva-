import { test, expect } from '@playwright/test';
import { reviewFixture } from './ui-review-fixture';

for (const [destination, label] of [
  ['/app/profile', 'הפרופיל שלי'],
  ['/app/preferences', 'העדפות חיפוש'],
] as const) {
  test(`missing lazy module offers explicit recovery to ${destination}`, async ({
    page,
    context,
  }, info) => {
    await reviewFixture(context, true);
    await page.goto('/app/resumes');
    const text = page.getByLabel('טקסט קורות החיים', { exact: true });
    await text.fill('Synthetic unsaved draft to preserve');
    await context.route('**/chunk-*.js', (route) => route.abort('failed'));
    const openMenu = async () => {
      const trigger = page.getByRole('button', { name: 'פתיחת תפריט', exact: true });
      if (await trigger.isVisible()) await trigger.click();
    };
    await openMenu();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('link', { name: label, exact: true }).click();
    const alert = page.getByRole('alert', { name: 'לא הצלחנו לפתוח את העמוד' });
    await expect(alert).toBeVisible();
    await expect(text).toHaveValue('Synthetic unsaved draft to preserve');
    await expect(page).toHaveURL(/\/app\/resumes$/);
    const recover = alert.getByRole('link', { name: 'טעינת העמוד והמשך' });
    await expect(recover).toHaveAttribute('href', destination);
    await alert.screenshot({
      path: `test-results/navigation-recovery-${info.project.name}-${destination.split('/').pop()}.png`,
    });
    await alert.getByRole('button', { name: 'להישאר כאן' }).click();
    await expect(alert).toHaveCount(0);
    await expect(text).toHaveValue('Synthetic unsaved draft to preserve');
    // The rejected import remains cached in this document, as in a stale live tab.
    await openMenu();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(alert).toBeVisible();
    await context.unroute('**/chunk-*.js');
    page.once('dialog', (dialog) => dialog.accept());
    await recover.click();
    await expect(page).toHaveURL(destination);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(alert).toHaveCount(0);
    await openMenu();
    await page.getByRole('link', { name: 'קורות חיים', exact: true }).click();
    await expect(page).toHaveURL('/app/resumes');
  });
}
