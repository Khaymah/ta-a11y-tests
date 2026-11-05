import { expect, test } from '@playwright/test';
import { expandFirstChapter, openPage, saveReportFile } from '../src/A11yHelpers';
import { MatnSlugs, TaPages } from '../src/TaPages';

for (const taPage of TaPages) {
  test(`records the accessibility tree: ${taPage.slug}`, {
    annotation: { type: 'ar', description: `تسجيل اللي قارئ الشاشة هيقراه — ${taPage.label}` },
  }, async ({ page }, testInfo) => {
    await openPage(page, taPage.path);
    if (MatnSlugs.includes(taPage.slug)) await expandFirstChapter(page);
    const snapshot = await page.locator('body').ariaSnapshot();
    const file = await saveReportFile(`screen-reader/${taPage.slug}.yml`, `# ${taPage.label} — ${taPage.path}\n${snapshot}\n`);
    await testInfo.attach('aria-snapshot', { path: file, contentType: 'text/yaml' });

    const unnamed = snapshot
      .split('\n')
      .filter((line) => /^\s*- (button|link|checkbox|textbox|searchbox|combobox|radio)\s*(:|$)/.test(line))
      .map((line) => line.trim());
    expect(unnamed, 'عناصر قارئ الشاشة هيقول عليها «زرار» أو «رابط» من غير اسم').toEqual([]);
  });
}
