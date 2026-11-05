import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FullConfig, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import type { AxeFinding } from './A11yHelpers';

type Row = {
  area: string;
  title: string;
  arabic: string;
  project: string;
  passed: boolean;
  skipped: boolean;
  reason: string;
};

type AxeBlock = {
  label: string;
  project: string;
  findings: AxeFinding[];
};

const AreaNames: Record<string, string> = {
  'Axe.spec.ts': 'فحص WCAG الآلي (axe)',
  'Structure.spec.ts': 'هيكل الصفحة والعناوين',
  'Keyboard.spec.ts': 'التنقل بالكيبورد والـ focus',
  'Reflow.spec.ts': 'الموبايل والتكبير وتباعد النص',
  'MediaAndControls.spec.ts': 'الصور والمصحف وأسماء العناصر',
  'AudioPlayer.spec.ts': 'مشغل التلاوة',
  'UserPreferences.spec.ts': 'تفضيلات المستخدم (حركة، تباين عالٍ، حجم الخط)',
  'ScreenReaderView.spec.ts': 'ما يسمعه قارئ الشاشة',
};

const ImpactNames: Record<string, string> = {
  critical: '🔴 حرجة',
  serious: '🟠 خطيرة',
  moderate: '🟡 متوسطة',
  minor: '⚪ بسيطة',
};

const ImpactOrder = ['critical', 'serious', 'moderate', 'minor'];

function cleanError(message: string): string {
  const lines = message
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const headline = (lines[0] ?? '').replace(/^Error:\s*/, '');
  const received = lines
    .filter((line) => /^\+\s+"/.test(line))
    .map((line) => line.replace(/^\+\s+"|",?$/g, '').replace(/\\"/g, '"'));
  const details = received.length
    ? received.slice(0, 8).concat(received.length > 8 ? [`… و${received.length - 8} كمان`] : [])
    : lines.filter((line) => /^Received:/.test(line)).slice(0, 1);
  return [headline, ...details]
    .join('<br>• ')
    .replace(/\|/g, '/')
    .replace(/</g, '&lt;')
    .replace(/&lt;br>/g, '<br>');
}

export default class ArabicReporter implements Reporter {
  private baseURL = '';
  private rows: Row[] = [];
  private axeBlocks: AxeBlock[] = [];

  onBegin(config: FullConfig, _suite: Suite): void {
    this.baseURL = String(config.projects[0]?.use.baseURL ?? '');
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const file = path.basename(test.location.file);
    const project = test.parent.project()?.name ?? '';
    const arabic = test.annotations.find((annotation) => annotation.type === 'ar')?.description ?? '';
    const passed = result.status === test.expectedStatus;
    const reason = passed ? '' : cleanError(result.errors.map((error) => error.message ?? '').join('\n'));

    const title = test.titlePath().slice(3).join(' › ');
    this.rows = this.rows.filter((row) => !(row.title === title && row.project === project && row.area === file));
    this.rows.push({ area: file, title, arabic, project, passed, skipped: result.status === 'skipped', reason });

    for (const attachment of result.attachments) {
      if (!attachment.name.startsWith('axe:') || !attachment.body) continue;
      const label = attachment.name.slice(4);
      this.axeBlocks = this.axeBlocks.filter((block) => !(block.label === label && block.project === project));
      this.axeBlocks.push({ label, project, findings: JSON.parse(attachment.body.toString('utf8')) as AxeFinding[] });
    }
  }

  onEnd(): void {
    const lines: string[] = [];
    const ran = this.rows.filter((row) => !row.skipped);
    const failed = ran.filter((row) => !row.passed);

    lines.push('# تقرير إتاحة منصّة «طا»', '');
    lines.push(`- **الموقع:** ${this.baseURL}`);
    lines.push(`- **وقت التشغيل:** ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`);
    lines.push(`- **النتيجة:** ✅ ${ran.length - failed.length} نجح · ❌ ${failed.length} فشل · ⏭️ ${this.rows.length - ran.length} متخطّى`, '');

    lines.push('## الملخص حسب المحور', '', '| المحور | ✅ نجح | ❌ فشل |', '|---|---|---|');
    for (const [file, name] of Object.entries(AreaNames)) {
      const inArea = ran.filter((row) => row.area === file);
      if (inArea.length === 0) continue;
      const bad = inArea.filter((row) => !row.passed).length;
      lines.push(`| ${name} | ${inArea.length - bad} | ${bad} |`);
    }
    lines.push('');

    if (failed.length > 0) {
      lines.push('## الاختبارات اللي فشلت (دي المشاكل اللي محتاجة إصلاح)', '');
      for (const [file, name] of Object.entries(AreaNames)) {
        const inArea = failed.filter((row) => row.area === file);
        if (inArea.length === 0) continue;
        lines.push(`### ${name}`, '', '| الاختبار | الجهاز | السبب |', '|---|---|---|');
        for (const row of inArea) {
          lines.push(`| ${row.arabic || row.title} | ${row.project} | ${row.reason} |`);
        }
        lines.push('');
      }
    }

    if (this.axeBlocks.length > 0) {
      lines.push('## تفاصيل axe لكل صفحة', '');
      lines.push('> القواعد المعلّمة **⛔** بتفشّل الاختبار (WCAG وخطورتها خطيرة أو حرجة). الباقي توصيات.', '');
      const sorted = [...this.axeBlocks].sort((a, b) => a.label.localeCompare(b.label) || a.project.localeCompare(b.project));
      for (const block of sorted) {
        lines.push(`### ${block.label} — ${block.project}`, '');
        if (block.findings.length === 0) {
          lines.push('✅ مفيش مخالفات آلية.', '');
          continue;
        }
        lines.push('| الخطورة | القاعدة | العدد | المعيار | الوصف | أمثلة |', '|---|---|---|---|---|---|');
        const findings = [...block.findings].sort((a, b) => ImpactOrder.indexOf(a.impact) - ImpactOrder.indexOf(b.impact));
        for (const finding of findings) {
          const rule = `${finding.blocking ? '⛔ ' : ''}[${finding.id}](${finding.helpUrl})`;
          const examples = finding.examples.map((example) => `\`${example.replace(/\|/g, '/')}\``).join('<br>');
          lines.push(`| ${ImpactNames[finding.impact] ?? finding.impact} | ${rule} | ${finding.count} | ${finding.wcag.join(' ')} | ${finding.help} | ${examples} |`);
        }
        lines.push('');
      }
    }

    lines.push('## ملفات مساعدة', '');
    lines.push('- `reports/html/index.html` — التقرير التفاعلي (`npm run report`)');
    lines.push('- `reports/screen-reader/*.yml` — شجرة الإتاحة: اللي قارئ الشاشة هيقراه بالترتيب');
    lines.push('- `reports/screens/*.png` — لقطات وضع التباين العالي والتكبير للمراجعة بالعين');
    lines.push('- `docs/ManualTesting.md` — سيناريوهات الاختبار اليدوي بـ NVDA وVoiceOver');

    const target = path.resolve(__dirname, '..', 'reports', 'A11yReport.md');
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${lines.join('\n')}\n`, 'utf8');
    console.log(`\n📄 التقرير العربي: ${target}`);
  }
}
