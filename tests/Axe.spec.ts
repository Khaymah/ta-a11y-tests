import { expect, test } from '@playwright/test';
import { expandFirstChapter, openPage, scanWithAxe } from '../src/A11yHelpers';
import { MatnPages, TaPages } from '../src/TaPages';

function blockingSummary(findings: Awaited<ReturnType<typeof scanWithAxe>>): string[] {
  return findings
    .filter((finding) => finding.blocking)
    .map((finding) => `${finding.id} ×${finding.count} (${finding.impact}): ${finding.help}`);
}

for (const taPage of TaPages) {
  test(`axe WCAG 2.2 AA scan: ${taPage.slug}`, {
    annotation: { type: 'ar', description: `فحص WCAG 2.2 AA الآلي — ${taPage.label}` },
  }, async ({ page }, testInfo) => {
    await openPage(page, taPage.path);
    const findings = await scanWithAxe(page, testInfo, taPage.label);
    expect(blockingSummary(findings), `مخالفات WCAG خطيرة في ${taPage.label}`).toEqual([]);
  });
}

for (const taPage of MatnPages) {
  test(`axe scan with an expanded chapter: ${taPage.slug}`, {
    annotation: { type: 'ar', description: `فحص الأبيات بعد فتح أول باب — ${taPage.label}` },
  }, async ({ page }, testInfo) => {
    await openPage(page, taPage.path);
    await expandFirstChapter(page);
    const findings = await scanWithAxe(page, testInfo, `${taPage.label} (باب مفتوح)`);
    expect(blockingSummary(findings), `مخالفات WCAG خطيرة في أبيات ${taPage.label}`).toEqual([]);
  });
}
