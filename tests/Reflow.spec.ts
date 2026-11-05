import { expect, test } from '@playwright/test';
import { expandFirstChapter, findClippedText, findHorizontalOverflow, openPage } from '../src/A11yHelpers';
import { MatnSlugs, TaPages } from '../src/TaPages';

const TextSpacingCss = `
  * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
  p { margin-bottom: 2em !important; }
`;

test.use({ viewport: { width: 320, height: 720 } });

for (const taPage of TaPages) {
  test.describe(`reflow: ${taPage.slug}`, () => {
    test.beforeEach(async ({ page }) => {
      await openPage(page, taPage.path);
      if (MatnSlugs.includes(taPage.slug)) await expandFirstChapter(page);
    });

    test('fits 320px width without horizontal scrolling (400% zoom)', {
      annotation: { type: 'ar', description: `مفيش scroll أفقي على 320px (= تكبير 400%) — ${taPage.label}` },
    }, async ({ page }) => {
      const { overflow, offenders } = await findHorizontalOverflow(page);
      expect(overflow, `الصفحة أعرض من الشاشة بـ ${overflow}px: ${offenders.join(' · ')}`).toBeLessThanOrEqual(1);
    });

    test('survives WCAG text-spacing overrides without clipping', {
      annotation: { type: 'ar', description: `النص مايتقصّش لما المستخدم يزوّد المسافات (WCAG 1.4.12) — ${taPage.label}` },
    }, async ({ page }) => {
      const alreadyClipped = new Set(await findClippedText(page));
      await page.addStyleTag({ content: TextSpacingCss });
      await page.waitForTimeout(300);
      const clipped = (await findClippedText(page)).filter((entry) => !alreadyClipped.has(entry));
      const { overflow } = await findHorizontalOverflow(page);
      expect(clipped, 'نصوص اتقصّت بسبب زيادة المسافات (ماكانتش مقصوصة قبلها)').toEqual([]);
      expect(overflow, 'ظهر scroll أفقي بعد زيادة المسافات').toBeLessThanOrEqual(1);
    });
  });
}
