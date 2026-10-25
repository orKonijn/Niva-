import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { reviewFixture, reviewJobs, reviewResume } from './ui-review-fixture';

async function sameRoute(page: Page, path: string) {
  await page.evaluate((path) => {
    history.pushState(null, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await expect(page).toHaveURL(new RegExp(path.replace(/[?]/g, '\\?') + '$'));
}
test('UI-01: full unbroken text reflows in dashboard, feed, saved, map and detail', async ({
  page,
  context,
}) => {
  await reviewFixture(context);
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 568 : 1000 });
      for (const path of [
        '/app',
        '/app/jobs',
        '/app/jobs?saved=true',
        '/app/jobs?view=map',
        '/app/jobs/' + reviewJobs[1].id,
        '/app/assistant?job=' + reviewJobs[1].id,
        '/app/resumes?job=' + reviewJobs[1].id,
      ]) {
        await page.goto(path);
        await expect(page.getByText(reviewJobs[1].title, { exact: true }).first()).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${colorScheme} ${width} ${path}`,
        ).toBe(true);
        if (!path.startsWith('/app/assistant') && !path.startsWith('/app/resumes')) {
          await expect(
            page.getByText(reviewJobs[1].company, { exact: true }).first(),
          ).toBeVisible();
        }
      }
    }
  }
});
test('UI-02: assistant context follows A/B/removal, Back/Forward and preserves draft/request context', async ({
  page,
  context,
}) => {
  const data = await reviewFixture(context);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/app/assistant?job=' + reviewJobs[0].id);
  const input = page.locator('textarea');
  await input.fill('Synthetic unsent draft');
  await sameRoute(page, '/app/assistant?job=' + reviewJobs[1].id);
  await expect(page.getByText(/הקשר משרה:/)).toContainText(reviewJobs[1].title);
  await expect(input).toHaveValue('Synthetic unsent draft');
  await page.goBack();
  await expect(page.getByText(/הקשר משרה:/)).toContainText(reviewJobs[0].title);
  await page.goForward();
  await expect(page.getByText(/הקשר משרה:/)).toContainText(reviewJobs[1].title);
  await page.getByLabel(/אני מסכים\/ה לעיבוד/).check();
  await page.getByRole('button', { name: 'שליחה', exact: true }).click();
  await expect.poll(() => data.chats.length).toBe(1);
  expect(data.chats[0]['jobId']).toBe(reviewJobs[1].id);
  await expect(page.getByRole('alert').filter({ hasText: /שירות|מלאכותית/ })).toBeVisible();
  await page.getByRole('link', { name: 'העוזרת שלך', exact: true }).click();
  await expect(page.getByText(/הקשר משרה:/)).toHaveCount(0);
  await expect(input).toHaveValue('Synthetic unsent draft');
  await page.getByRole('button', { name: 'שליחה', exact: true }).click();
  await expect.poll(() => data.chats.length).toBe(2);
  expect(data.chats[1]['jobId']).toBeUndefined();
});
test('UI-02: late assistant output cannot overwrite a new URL context or draft', async ({
  page,
  context,
}) => {
  await reviewFixture(context);
  let finish: (() => void) | undefined;
  await page.route('**/api/career/chat', async (r) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    await r
      .fulfill({
        contentType: 'text/event-stream',
        body: 'event: context\ndata: {"conversationId":"old-context","jobs":[]}\n\nevent: delta\ndata: {"text":"OBSOLETE SYNTHETIC ANSWER"}\n\nevent: done\ndata: {}\n\n',
      })
      .catch(() => {});
  });
  await page.goto('/app/assistant?job=' + reviewJobs[0].id);
  await page.locator('textarea').fill('Synthetic unsent draft');
  await page.getByLabel(/אני מסכים\/ה לעיבוד/).check();
  await page.getByRole('button', { name: 'שליחה', exact: true }).click();
  await expect.poll(() => !!finish).toBe(true);
  await sameRoute(page, '/app/assistant?job=' + reviewJobs[1].id);
  await expect(page.getByText(/הקשר משרה:/)).toContainText(reviewJobs[1].title);
  finish!();
  await expect(page.locator('textarea')).toHaveValue('Synthetic unsent draft');
  await expect(page.getByText('OBSOLETE SYNTHETIC ANSWER')).toHaveCount(0);
});
test('UI-04: shared login/reset password errors expose descriptions and recovery focus', async ({
  page,
  context,
}) => {
  await reviewFixture(context);
  for (const path of ['/login', '/reset-password?token=synthetic']) {
    await page.goto(path);
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('#account-password')).toHaveAccessibleDescription(
      /נדרשת סיסמה באורך/,
    );
    await expect(
      page.locator(path === '/login' ? 'input[name="email"]' : '#account-password'),
    ).toBeFocused();
  }
});
for (const outcome of ['success', 'failure'])
  test(`UI-02: resume context clears and obsolete tailoring ${outcome} cannot replace selection`, async ({
    page,
    context,
  }) => {
    const data = await reviewFixture(context);
    let finish: (() => void) | undefined;
    await page.route('**/api/career/tailor', async (r) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      if (outcome === 'failure')
        return r.fulfill({ status: 503, json: { error: 'AI_UNAVAILABLE' } });
      data.resumes.push({
        ...reviewResume,
        id: 'late-result',
        name: 'תוצאה ישנה',
        active: false,
        kind: 'tailored',
        parentId: reviewResume.id,
      });
      await r.fulfill({
        json: data.resumes.at(-1),
        headers: { 'X-Niva-Lifecycle': 'fixture', 'X-Niva-Erasure': 'fixture' },
      });
    });
    await page.goto('/app/resumes?job=' + reviewJobs[0].id);
    await page.getByRole('button', { name: reviewResume.name, exact: true }).click();
    await page.getByRole('button', { name: 'יצירת טיוטה מותאמת למשרה', exact: true }).click();
    await expect.poll(() => !!finish).toBe(true);
    await sameRoute(page, '/app/resumes?job=' + reviewJobs[1].id);
    await expect(page.getByRole('heading', { name: /התאמה למשרה:/ })).toContainText(
      reviewJobs[1].title,
    );
    finish!();
    await expect(page.getByRole('heading', { name: /בדיקת הגרסה:/ })).toContainText(
      reviewResume.name,
    );
    const edit = page.getByRole('textbox', { name: 'טקסט לבדיקה ולתיקון', exact: true });
    await expect(edit).toBeEnabled();
    if (outcome === 'failure') await expect(page.getByRole('status')).toHaveCount(0);
    await edit.fill('Synthetic unrelated draft remains intact');
    await sameRoute(page, '/app/resumes');
    await expect(page.getByRole('heading', { name: /התאמה למשרה:/ })).toHaveCount(0);
    await expect(edit).toHaveValue('Synthetic unrelated draft remains intact');
    await page.goBack();
    await expect(page.getByRole('heading', { name: /התאמה למשרה:/ })).toContainText(
      reviewJobs[1].title,
    );
  });
for (const failure of ['404', '401', '429', '503', 'invalid', 'invalid-json', 'network', 'timeout'])
  test(`UI-03: listing ${failure} is classified and individual retry recovers`, async ({
    page,
    context,
  }) => {
    await reviewFixture(context);
    await page.route('**/api/feed?**', (r) =>
      r.fulfill({ json: { jobs: [], total: 0, health: [], snapshot: 'empty' } }),
    );
    let calls = 0;
    await page.route('**/api/listings/*', async (r) => {
      if (++calls > 1)
        return r.fulfill({ json: { ...reviewJobs[0], id: 'greenhouse-appsflyer-777' } });
      if (failure === 'network') return r.abort('failed');
      if (failure === 'timeout') {
        await new Promise((resolve) => setTimeout(resolve, 11000));
        return r.fulfill({ json: reviewJobs[0] }).catch(() => {});
      }
      if (failure === 'invalid') return r.fulfill({ json: { id: 'wrong', title: 'Incomplete' } });
      if (failure === 'invalid-json')
        return r.fulfill({ contentType: 'application/json', body: '{malformed' });
      return r.fulfill({ status: Number(failure), json: { error: 'SYNTHETIC_FAILURE' } });
    });
    await page.goto('/app/jobs/greenhouse-appsflyer-777');
    if (failure === '404') {
      await expect(
        page.getByRole('heading', { name: 'המשרה לא נמצאה', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'ניסיון נוסף', exact: true })).toHaveCount(0);
      return;
    }
    await expect(
      page.getByRole('heading', { name: 'לא ניתן לטעון את המשרה כרגע', exact: true }),
    ).toBeVisible({ timeout: 15000 });
    if (failure === '401')
      await expect(page.getByRole('link', { name: 'כניסה מחדש לחשבון' })).toBeVisible();
    const messages: Record<string, RegExp> = {
      '429': /בקשות רבות/,
      '503': /אינו זמין/,
      invalid: /לא תקינה/,
      'invalid-json': /לא תקינה/,
      network: /החיבור/,
      timeout: /ארכה יותר מדי/,
    };
    if (messages[failure]) await expect(page.getByRole('alert')).toContainText(messages[failure]);
    await page.getByRole('button', { name: 'ניסיון נוסף', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: reviewJobs[0].title, exact: true }),
    ).toBeVisible();
    expect(calls).toBe(2);
  });
test('UI-04: validation describes errors, focuses first invalid field and preserves server-failure values', async ({
  page,
  context,
}) => {
  await reviewFixture(context);
  await page.goto('/register');
  const submit = page.getByRole('button', { name: 'יצירת חשבון', exact: true });
  await submit.click();
  await expect(page.locator('input[name="name"]')).toBeFocused();
  const password = page.locator('#account-password');
  await expect(password).toHaveAttribute('aria-invalid', 'true');
  await expect(password).toHaveAccessibleDescription(/נדרשת סיסמה באורך/);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.locator('input[name="name"]').fill('Synthetic Person');
  await submit.click();
  await expect(page.locator('input[name="email"]')).toBeFocused();
  await page.locator('input[name="email"]').fill('synthetic@example.test');
  await submit.click();
  await expect(password).toBeFocused();
  await password.fill('Synthetic-passphrase-123');
  await submit.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('input[name="email"]')).toHaveValue('synthetic@example.test');
  await expect(password).toHaveValue('Synthetic-passphrase-123');
});
test('UI-05: deletion dialog is discoverable, cancellable and guarded on short mobile', async ({
  page,
  context,
}) => {
  const data = await reviewFixture(context);
  await page.setViewportSize({ width: 390, height: 568 });
  await page.goto('/app/resumes');
  const trigger = page.getByRole('button', { name: 'מחיקת גרסה', exact: true });
  await trigger.click();
  const dialog = page.getByRole('alertdialog', { name: 'למחוק את הגרסה?', exact: true });
  await expect(dialog).toBeVisible();
  const cancel = dialog.getByRole('button', { name: 'ביטול', exact: true });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await expect(cancel).toBeFocused();
  await expect(cancel).toBeInViewport();
  const confirm = dialog.getByRole('button', { name: 'אישור מחיקה לצמיתות', exact: true });
  await expect(confirm).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await cancel.click();
  await expect(trigger).toBeFocused();
  expect(data.deletes).toBe(0);
  await trigger.click();
  await confirm.click({ clickCount: 2 });
  await expect(dialog).not.toBeVisible();
  expect(data.deletes).toBe(1);
});
test('UI-05: confirmation choices stay keyboard reachable at short reflow and landscape sizes', async ({
  page,
  context,
}) => {
  await reviewFixture(context);
  for (const [width, height] of [
    [320, 200],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/app/resumes');
    const trigger = page.getByRole('button', { name: 'מחיקת גרסה', exact: true });
    await trigger.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByRole('button', { name: 'ביטול', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    const confirm = dialog.getByRole('button', { name: 'אישור מחיקה לצמיתות', exact: true });
    await expect(confirm).toBeFocused();
    await expect(confirm).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }
});
test('UI-06–08: returning workflow, artwork, system theme, landscape, motion and accessibility', async ({
  page,
  context,
}) => {
  await reviewFixture(context);
  await page.goto('/app/resumes');
  await expect(page.locator('.resume-create')).not.toHaveAttribute('open');
  await page.getByRole('button', { name: reviewResume.name, exact: true }).click();
  expect(
    await page
      .getByRole('heading', { name: /בדיקת הגרסה:/ })
      .evaluate(
        (el) =>
          el.compareDocumentPosition(document.querySelector('.resume-create')!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
  ).toBeTruthy();
  for (const colorScheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
    expect(await page.locator('html').evaluate((el) => getComputedStyle(el).scrollBehavior)).toBe(
      'auto',
    );
    expect(
      await page
        .getByRole('button', { name: reviewResume.name, exact: true })
        .evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe('0s');
    await page.setViewportSize({ width: 844, height: 390 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/signup');
  const art = page.locator('.onboarding-aside > img');
  await expect(art).toBeVisible();
  expect(await art.evaluate((el) => getComputedStyle(el).mixBlendMode)).toBe('normal');
});
