import { expect, test } from '@playwright/test';
import { describeStops, openPage, walkFocusOrder } from '../src/A11yHelpers';
import { TaPages } from '../src/TaPages';

for (const taPage of TaPages) {
  test.describe(`keyboard: ${taPage.slug}`, () => {
    test.beforeEach(async ({ page }) => {
      await openPage(page, taPage.path);
    });

    test('first Tab reaches a working skip link', {
      annotation: { type: 'ar', description: `أول Tab يوصل لرابط «تخطَّ للمحتوى» شغّال — ${taPage.label}` },
    }, async ({ page }) => {
      await page.keyboard.press('Tab');
      const first = await page.evaluate(() => {
        const element = document.activeElement as HTMLAnchorElement | null;
        const href = element?.getAttribute('href') ?? '';
        const target = href.startsWith('#') && href.length > 1 ? document.getElementById(decodeURIComponent(href.slice(1))) : null;
        return { tag: element?.tagName ?? '', href, text: (element?.innerText ?? '').trim(), targetExists: Boolean(target) };
      });
      expect(first.href.startsWith('#') && first.targetExists, `أول عنصر بيتعمله focus هو <${first.tag}> «${first.text}» مش رابط تخطٍّ`).toBe(true);
    });

    test('every focus stop shows a visible focus indicator', {
      annotation: { type: 'ar', description: `كل عنصر بيتعمله focus يبان عليه — ${taPage.label}` },
    }, async ({ page }, testInfo) => {
      const walk = await walkFocusOrder(page);
      await testInfo.attach('focus-order', { body: describeStops(walk.stops).join('\n'), contentType: 'text/plain' });
      const invisible = describeStops(walk.stops.filter((stop) => stop.indicator === 'none'));
      expect(invisible, 'عناصر مفيش أي تغيير بصري لما يتعملها focus').toEqual([]);
    });

    test('focus indicators are strong rings, not colour tints', {
      annotation: { type: 'ar', description: `مؤشر الـ focus إطار واضح مش مجرد تغيير لون خلفية — ${taPage.label}` },
    }, async ({ page }) => {
      const walk = await walkFocusOrder(page);
      const weak = describeStops(walk.stops.filter((stop) => stop.indicator === 'color-only'));
      expect(weak, 'عناصر الـ focus عليها مجرد تغيير لون باهت').toEqual([]);
    });

    test('keyboard focus never gets trapped', {
      annotation: { type: 'ar', description: `مفيش عنصر يحبس الكيبورد — ${taPage.label}` },
    }, async ({ page }) => {
      const walk = await walkFocusOrder(page, 80);
      expect(walk.trappedAt, 'الـ focus اتحبس عند').toBeNull();
    });
  });
}
