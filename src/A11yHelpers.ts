import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';

export const ReportsDir = path.resolve(__dirname, '..', 'reports');

const WcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export type AxeFinding = {
  id: string;
  impact: string;
  help: string;
  helpUrl: string;
  count: number;
  wcag: string[];
  examples: string[];
  blocking: boolean;
};

export type FocusIndicator = 'outline' | 'shadow' | 'color-only' | 'none';

export type FocusStop = {
  order: number;
  tag: string;
  name: string;
  indicator: FocusIndicator;
};

export type FocusWalk = {
  stops: FocusStop[];
  trappedAt: string | null;
};

export async function openPage(page: Page, pagePath: string): Promise<void> {
  await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  await page.locator('h1, main, img').first().waitFor({ timeout: 15_000 }).catch(() => undefined);
}

export async function expandFirstChapter(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'فتح الباب' }).first();
  if ((await toggle.count()) === 0) return;
  await toggle.click();
  await page.locator('.verseCard').first().waitFor({ timeout: 10_000 });
}

export async function scanWithAxe(page: Page, testInfo: TestInfo, label: string): Promise<AxeFinding[]> {
  const results = await new AxeBuilder({ page }).withTags([...WcagTags, 'best-practice']).analyze();
  const findings: AxeFinding[] = results.violations.map((violation) => {
    const wcag = violation.tags.filter((tag) => /^wcag\d/.test(tag));
    const impact = violation.impact ?? 'minor';
    return {
      id: violation.id,
      impact,
      help: violation.help,
      helpUrl: violation.helpUrl,
      count: violation.nodes.length,
      wcag,
      examples: violation.nodes.slice(0, 3).map((node) => node.target.map(String).join(' ')),
      blocking: wcag.length > 0 && (impact === 'serious' || impact === 'critical'),
    };
  });
  await testInfo.attach(`axe:${label}`, { body: JSON.stringify(findings), contentType: 'application/json' });
  return findings;
}

export async function walkFocusOrder(page: Page, maxStops = 40): Promise<FocusWalk> {
  let previousKey = '';
  let trappedAt: string | null = null;

  for (let order = 0; order < maxStops; order++) {
    await page.keyboard.press('Tab');
    const step = await page.evaluate((index) => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return { key: '', seen: false, name: '' };
      const name = (element.getAttribute('aria-label') ?? element.innerText ?? '').trim().slice(0, 40);
      if (element.dataset.a11yStop) return { key: element.dataset.a11yStop, seen: true, name };
      const style = getComputedStyle(element);
      element.dataset.a11yStop = String(index);
      element.dataset.a11yFocused = JSON.stringify([
        style.outlineStyle,
        style.outlineWidth,
        style.boxShadow,
        style.backgroundColor,
        style.borderColor,
        style.color,
        style.textDecorationLine,
      ]);
      return { key: String(index), seen: false, name };
    }, order);

    if (!step.key) continue;
    if (step.seen && step.key === previousKey) {
      trappedAt = step.name || step.key;
      break;
    }
    if (step.seen) break;
    previousKey = step.key;
  }

  const stops = await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    return [...document.querySelectorAll<HTMLElement>('[data-a11y-stop]')]
      .map((element) => {
        const rest = getComputedStyle(element);
        const [outlineStyle, outlineWidth, boxShadow, background, border, color, decoration] = JSON.parse(
          element.dataset.a11yFocused ?? '[]',
        ) as string[];
        const outlineAppears =
          outlineStyle !== 'none' &&
          (outlineStyle === 'auto' || parseFloat(outlineWidth) >= 2) &&
          (rest.outlineStyle !== outlineStyle || rest.outlineWidth !== outlineWidth);
        const shadowAppears = boxShadow !== 'none' && boxShadow !== rest.boxShadow;
        const colorChanges =
          background !== rest.backgroundColor ||
          border !== rest.borderColor ||
          color !== rest.color ||
          decoration !== rest.textDecorationLine;
        const indicator = outlineAppears ? 'outline' : shadowAppears ? 'shadow' : colorChanges ? 'color-only' : 'none';
        return {
          order: Number(element.dataset.a11yStop),
          tag: element.tagName.toLowerCase(),
          name: (element.getAttribute('aria-label') ?? element.innerText ?? element.getAttribute('placeholder') ?? '')
            .trim()
            .slice(0, 40),
          indicator: indicator as 'outline' | 'shadow' | 'color-only' | 'none',
        };
      })
      .sort((a, b) => a.order - b.order);
  });

  return { stops, trappedAt };
}

export function describeStops(stops: FocusStop[]): string[] {
  return stops.map(
    (stop) => `${stop.order + 1}. <${stop.tag}> «${stop.name.replace(/\s+/g, ' ') || 'بدون اسم'}» → ${stop.indicator}`,
  );
}

export async function findHorizontalOverflow(page: Page): Promise<{ overflow: number; offenders: string[] }> {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - viewport;
    const offenders = [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 1 && rect.height > 1 && (rect.right > viewport + 1 || rect.left < -1))
      .slice(0, 5)
      .map(({ element, rect }) => `${element.tagName.toLowerCase()}.${element.className} (${Math.round(rect.left)}→${Math.round(rect.right)})`);
    return { overflow, offenders };
  });
}

export async function findClippedText(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const clips = ['hidden', 'clip'].includes(style.overflowX) || ['hidden', 'clip'].includes(style.overflowY);
        if (!clips || style.visibility === 'hidden' || element.closest('[aria-hidden="true"]')) return false;
        const ownText = [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? '')
          .join('')
          .trim();
        if (ownText.length < 3 || element.clientWidth <= 1) return false;
        const verticalLoss = element.scrollHeight - element.clientHeight;
        return verticalLoss > Math.max(6, element.clientHeight * 0.3) || element.scrollWidth > element.clientWidth + 2;
      })
      .slice(0, 80)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}: «${element.innerText.trim().slice(0, 30)}»`),
  );
}

export async function saveReportFile(relativePath: string, content: string): Promise<string> {
  const target = path.join(ReportsDir, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
  return target;
}
