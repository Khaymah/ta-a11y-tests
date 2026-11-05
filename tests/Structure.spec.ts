import { expect, test } from '@playwright/test';
import { openPage } from '../src/A11yHelpers';
import { TaPages } from '../src/TaPages';

for (const taPage of TaPages) {
  test.describe(`structure: ${taPage.slug}`, () => {
    test.beforeEach(async ({ page }) => {
      await openPage(page, taPage.path);
    });

    test('declares Arabic language and RTL direction', {
      annotation: { type: 'ar', description: `lang="ar" وdir="rtl" — ${taPage.label}` },
    }, async ({ page }) => {
      const html = page.locator('html');
      await expect(html, 'لازم lang="ar" عشان قارئ الشاشة ينطق عربي').toHaveAttribute('lang', /^ar/);
      await expect(html, 'لازم dir="rtl"').toHaveAttribute('dir', 'rtl');
    });

    test('has a descriptive page title', {
      annotation: { type: 'ar', description: `عنوان التبويب يوصف الصفحة — ${taPage.label}` },
    }, async ({ page }) => {
      expect((await page.title()).trim().length, 'الصفحة ملهاش <title>').toBeGreaterThan(3);
    });

    test('has exactly one main landmark', {
      annotation: { type: 'ar', description: `منطقة <main> واحدة للمحتوى — ${taPage.label}` },
    }, async ({ page }) => {
      expect(await page.locator('main, [role="main"]').count(), 'عدد عناصر <main> لازم يكون 1').toBe(1);
    });

    test('has exactly one h1', {
      annotation: { type: 'ar', description: `عنوان رئيسي h1 واحد — ${taPage.label}` },
    }, async ({ page }) => {
      expect(await page.locator('h1').count(), 'عدد عناوين h1 لازم يكون 1').toBe(1);
    });

    test('heading levels do not skip', {
      annotation: { type: 'ar', description: `العناوين متدرجة من غير قفز (h2 ثم h4 مثلاً) — ${taPage.label}` },
    }, async ({ page }) => {
      const levels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((headings) =>
        headings
          .filter((heading) => (heading as HTMLElement).offsetParent !== null)
          .map((heading) => ({ level: Number(heading.tagName[1]), text: (heading.textContent ?? '').trim().slice(0, 30) })),
      );
      const jumps = levels
        .map((heading, index) => ({ heading, previous: levels[index - 1] }))
        .filter(({ heading, previous }) => previous && heading.level > previous.level + 1)
        .map(({ heading, previous }) => `h${previous.level} «${previous.text}» → h${heading.level} «${heading.text}»`);
      expect(jumps, 'قفزات في مستويات العناوين').toEqual([]);
    });
  });
}
