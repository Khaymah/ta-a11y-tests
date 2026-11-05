import { expect, test } from '@playwright/test';
import { expandFirstChapter, openPage } from '../src/A11yHelpers';
import { MatnSlugs, MushafPage, TaPages } from '../src/TaPages';

for (const taPage of TaPages) {
  test(`images have meaningful alternatives: ${taPage.slug}`, {
    annotation: { type: 'ar', description: `كل صورة ليها وصف (alt) مفيد — ${taPage.label}` },
  }, async ({ page }) => {
    await openPage(page, taPage.path);
    const problems = await page.locator('img').evaluateAll((images) =>
      images
        .map((image) => ({ alt: image.getAttribute('alt'), src: (image.getAttribute('src') ?? '').split('/').pop() ?? '' }))
        .filter(({ alt, src }) => alt === null || /\.(png|jpe?g|webp|svg|gif)$/i.test(alt) || (alt.length > 0 && alt === src))
        .map(({ alt, src }) => `${src}: alt=${alt === null ? 'مفقود' : `«${alt}»`}`),
    );
    expect(problems, 'صور من غير وصف مناسب').toEqual([]);
  });

  test(`form controls have real labels: ${taPage.slug}`, {
    annotation: { type: 'ar', description: `خانات الإدخال والاختيار ليها اسم واضح مش placeholder أو رقم بس — ${taPage.label}` },
  }, async ({ page }) => {
    await openPage(page, taPage.path);
    if (MatnSlugs.includes(taPage.slug)) await expandFirstChapter(page);
    const problems = await page
      .locator('input:not([type="hidden"]), select, textarea, [role="progressbar"], [role="slider"]')
      .evaluateAll((controls) =>
        controls
          .filter((control) => (control as HTMLElement).offsetParent !== null || control.getAttribute('role') === 'progressbar')
          .map((control) => {
            const field = control as HTMLInputElement;
            const labelledBy = (control.getAttribute('aria-labelledby') ?? '')
              .split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent ?? '')
              .join(' ');
            const fromLabels = [...(field.labels ?? [])].map((label) => label.innerText).join(' ');
            const name = (control.getAttribute('aria-label') ?? '') || labelledBy || fromLabels || (control.getAttribute('title') ?? '');
            const kind = control.getAttribute('role') ?? `${control.tagName.toLowerCase()}[${field.type ?? ''}]`;
            return { kind, name: name.trim(), placeholder: control.getAttribute('placeholder') ?? '' };
          })
          .filter(({ name }) => name.length === 0 || /^[\d٠-٩\s/]+$/.test(name))
          .map(({ kind, name, placeholder }) =>
            name.length === 0
              ? `${kind}: بدون اسم${placeholder ? ` (فيه placeholder «${placeholder}» بس)` : ''}`
              : `${kind}: اسمه «${name}» بس`,
          ),
      );
    expect([...new Set(problems)], 'عناصر تحكم اسمها مش مفهوم لقارئ الشاشة').toEqual([]);
  });
}

test('mushaf pages expose the Quran text, not only images', {
  annotation: { type: 'ar', description: 'صفحة المصحف فيها نص الآيات لقارئ الشاشة مش صور بس' },
}, async ({ page }) => {
  await openPage(page, MushafPage.path);
  const exposed = await page.evaluate(() => {
    const images = [...document.querySelectorAll('img')].map((image) => image.alt).join(' ');
    const text = document.body.innerText.replace(/\s+/g, ' ').trim();
    return { textLength: text.length, imageAlts: images.slice(0, 80) };
  });
  expect(
    exposed.textLength,
    `الصفحة كلها ${exposed.textLength} حرف بس، والآيات صور وصفها «${exposed.imageAlts}». المكفوف مش هيوصل للقرآن`,
  ).toBeGreaterThan(300);
});

test('mushaf page changes are announced', {
  annotation: { type: 'ar', description: 'تغيير صفحة المصحف بيتعلن لقارئ الشاشة' },
}, async ({ page }) => {
  await openPage(page, MushafPage.path);
  const live = await page.locator('[aria-live], [role="status"]').evaluateAll((regions) =>
    regions.filter((region) => region.id !== '__next-route-announcer__').length,
  );
  expect(live, 'مفيش aria-live يعلن رقم الصفحة الحالية').toBeGreaterThan(0);
});
