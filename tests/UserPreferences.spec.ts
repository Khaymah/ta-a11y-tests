import { expect, test } from '@playwright/test';
import { describeStops, expandFirstChapter, openPage, ReportsDir, walkFocusOrder } from '../src/A11yHelpers';
import { MatnSlugs, PlayerPage, TaPages } from '../src/TaPages';

for (const taPage of TaPages) {
  test(`respects prefers-reduced-motion: ${taPage.slug}`, {
    annotation: { type: 'ar', description: `مفيش حركة مستمرة لما المستخدم يطلب تقليل الحركة — ${taPage.label}` },
  }, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPage(page, taPage.path);
    await page.waitForTimeout(500);
    const moving = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => animation.playState === 'running')
        .map((animation) => ({ animation, timing: animation.effect?.getComputedTiming() }))
        .filter(({ timing }) => timing && (timing.iterations === Infinity || Number(timing.duration) > 500))
        .map(({ animation }) => {
          const target = (animation.effect as KeyframeEffect | null)?.target as HTMLElement | null;
          return `${target?.tagName.toLowerCase() ?? '?'}.${target?.className ?? ''}`;
        }),
    );
    expect(moving, 'عناصر لسه بتتحرك رغم تفعيل تقليل الحركة').toEqual([]);
  });

  test(`text scales with the browser font size: ${taPage.slug}`, {
    annotation: { type: 'ar', description: `(توصية) الخط بيكبر لما المستخدم يكبّر خط المتصفح (rem مش px) — ${taPage.label}` },
  }, async ({ page }) => {
    await openPage(page, taPage.path);
    if (MatnSlugs.includes(taPage.slug)) await expandFirstChapter(page);
    const selector = 'h1, h2, p, .verseText, button, a';
    const measure = () =>
      page.locator(selector).evaluateAll((elements) =>
        elements.slice(0, 60).map((element) => parseFloat(getComputedStyle(element).fontSize)),
      );
    const before = await measure();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    const after = await measure();
    const fixed = before.filter((size, index) => after[index] / size < 1.4).length;
    expect(fixed / Math.max(before.length, 1), `${fixed} من ${before.length} عنصر حجم خطهم ثابت بالـ px`).toBeLessThan(0.2);
  });
}

test('focus stays visible in Windows high-contrast mode', {
  annotation: { type: 'ar', description: 'الـ focus يفضل باين في وضع التباين العالي في ويندوز (لازم outline مش خلفية أو ظل)' },
}, async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await openPage(page, PlayerPage.path);
  await page.screenshot({ path: `${ReportsDir}/screens/forced-colors-${PlayerPage.slug}.png`, fullPage: false });
  const walk = await walkFocusOrder(page);
  const lost = describeStops(walk.stops.filter((stop) => stop.indicator !== 'outline'));
  expect(lost, 'عناصر الـ focus بتاعها هيختفي في التباين العالي لأنه خلفية أو ظل مش outline').toEqual([]);
});

test('offers a dark or high-contrast theme', {
  annotation: { type: 'ar', description: 'المنصة بتحترم الوضع الداكن أو طلب تباين أعلى' },
}, async ({ page }) => {
  await openPage(page, PlayerPage.path);
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: 'dark', contrast: 'more' });
  await page.waitForTimeout(300);
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.screenshot({ path: `${ReportsDir}/screens/dark-${PlayerPage.slug}.png` });
  expect(dark, 'الخلفية متغيرتش، يعني مفيش وضع داكن أو تباين عالي').not.toBe(light);
});
