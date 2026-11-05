import { expect, test } from '@playwright/test';
import { expandFirstChapter, openPage } from '../src/A11yHelpers';
import { PlayerPage } from '../src/TaPages';

test.describe('audio player', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, PlayerPage.path);
    await expandFirstChapter(page);
  });

  test('player controls are exposed as named buttons', {
    annotation: { type: 'ar', description: 'أزرار المشغل (السابق، تشغيل، إيقاف، التالي) ليها أسماء' },
  }, async ({ page }) => {
    for (const name of ['السابق', 'تشغيل', 'إيقاف', 'التالي']) {
      await expect(page.getByRole('button', { name, exact: true }), `زرار «${name}» مش موجود باسمه`).toBeVisible();
    }
  });

  test('playback starts and pauses using only the keyboard', {
    annotation: { type: 'ar', description: 'تشغيل التلاوة وإيقافها بالكيبورد بس' },
  }, async ({ page }) => {
    await page.getByRole('button', { name: /تحديد الباب/ }).first().focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'تشغيل', exact: true }).focus();
    await page.keyboard.press('Enter');
    const pause = page.getByRole('button', { name: 'إيقاف مؤقت', exact: true });
    await expect(pause, 'التشغيل مابدأش بالكيبورد').toBeVisible();
    await pause.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'تشغيل', exact: true }), 'الإيقاف المؤقت ماشتغلش بالكيبورد').toBeVisible();
  });

  test('the verse being recited is exposed to assistive tech', {
    annotation: { type: 'ar', description: 'البيت اللي بيتقري دلوقتي متعلّم لقارئ الشاشة (aria-current أو إعلان)' },
  }, async ({ page }) => {
    await page.getByRole('button', { name: 'قراءة الشاهد' }).first().click();
    await expect(page.locator('.verseCard.isPlaying'), 'التشغيل مابدأش').toHaveCount(1);
    const exposure = await page.evaluate(() => {
      const playing = document.querySelector('.verseCard.isPlaying');
      const marked = playing?.matches('[aria-current]:not([aria-current="false"])') ?? false;
      const announced = [...document.querySelectorAll('[role="status"], [aria-live]')].some(
        (region) => region.id !== '__next-route-announcer__' && (region.textContent ?? '').length < 300 && /بيت|يُتلى|تشغيل/.test(region.textContent ?? ''),
      );
      return { marked, announced };
    });
    expect(
      exposure.marked || exposure.announced,
      'البيت اللي بيتقري متعلّم بـ class="isPlaying" بس، ومفيش aria-current ولا إعلان، فالمكفوف مش عارف التلاوة واقفة فين',
    ).toBe(true);
  });

  test('live regions stay short', {
    annotation: { type: 'ar', description: 'مناطق aria-live صغيرة، مش بتعيد قراءة الصفحة كلها' },
  }, async ({ page }) => {
    const oversized = await page.locator('[aria-live]').evaluateAll((regions) =>
      regions
        .filter((region) => (region.textContent ?? '').length > 300)
        .map((region) => `<${region.tagName.toLowerCase()} class="${region.className}"> فيها ${(region.textContent ?? '').length} حرف`),
    );
    expect(oversized, 'منطقة aria-live بتغطي محتوى كبير، وأي تغيير هيخلي قارئ الشاشة يقرا كل ده').toEqual([]);
  });
});
