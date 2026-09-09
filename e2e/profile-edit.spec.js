const { test, expect } = require('@playwright/test');

const studentId = process.env.E2E_STUDENT_ID || '202600001';
const password = process.env.E2E_PASSWORD || 'TestPass123';

function profileNav(page) {
  return page.locator('.nav-item[data-page="profile"]').first();
}

async function login(page) {
  await page.goto('/');

  const loginPrompt = page.locator('#login-prompt-btn');
  if (await loginPrompt.isVisible().catch(() => false)) {
    await loginPrompt.click();
  }

  await expect(page.locator('input[name="studentId"]')).toBeVisible();
  await page.fill('input[name="studentId"]', studentId);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForFunction(() => Boolean(window._currentUser));
  await expect(profileNav(page)).toBeVisible();
}

test('profile edit opens once after repeated profile renders', async ({ page }) => {
  const consoleIssues = [];
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) {
      consoleIssues.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    consoleIssues.push(`pageerror: ${err.message}`);
  });

  await login(page);

  for (let i = 0; i < 3; i += 1) {
    await profileNav(page).click();
    await expect(page.locator('.profile-list-item[data-page="profile-edit"]')).toBeVisible();
  }
  await page.waitForTimeout(900);

  await page.evaluate(() => {
    window.__profileEditAnimations = 0;
    const originalAnimate = Element.prototype.animate;
    Element.prototype.animate = function(...args) {
      const keyframes = args[0];
      const finalFrame = Array.isArray(keyframes) ? keyframes[keyframes.length - 1] : null;
      if (this.classList?.contains('profile-card') && finalFrame?.opacity === 1) {
        window.__profileEditAnimations += 1;
      }
      return originalAnimate.apply(this, args);
    };
  });

  await page.click('.profile-list-item[data-page="profile-edit"]');
  await expect(page).toHaveURL(/\/profile\/edit$/);
  await expect(page.locator('#profile-save-btn')).toBeVisible();
  await page.waitForTimeout(900);

  const animationCount = await page.evaluate(() => window.__profileEditAnimations);
  expect(animationCount).toBeLessThanOrEqual(1);
  expect(consoleIssues.filter(line => !line.includes('favicon'))).toEqual([]);
});
