export type TaPage = {
  slug: string;
  path: string;
  label: string;
};

const AllPages: readonly TaPage[] = [
  { slug: 'home', path: '/', label: 'الرئيسية' },
  { slug: 'taiyebah', path: '/modules/taiyebah', label: 'طيبة النشر' },
  { slug: 'shatibiyyah', path: '/modules/shatibiyyah', label: 'الشاطبية' },
  { slug: 'durrah', path: '/modules/durrah', label: 'الدرة المضية' },
  { slug: 'jazariyyah', path: '/modules/jazariyyah', label: 'المقدمة الجزرية' },
  { slug: 'salsabil', path: '/modules/salsabil', label: 'السلسبيل الشافي' },
  { slug: 'tuhfah', path: '/modules/tuhfah', label: 'تحفة الأطفال' },
  { slug: 'mutashabih', path: '/modules/mutashabih', label: 'متشابه' },
  { slug: 'mushaf', path: '/modules/masahif/sughra', label: 'المصحف' },
  { slug: 'collection', path: '/modules/collection', label: 'محفوظاتي' },
  { slug: 'feedback', path: '/feedback', label: 'التواصل' },
];

const only = (process.env.TA_ONLY ?? '')
  .split(',')
  .map((slug) => slug.trim())
  .filter(Boolean);

export const TaPages: readonly TaPage[] = only.length
  ? AllPages.filter((page) => only.includes(page.slug))
  : AllPages;

export const MatnSlugs = ['taiyebah', 'shatibiyyah', 'durrah', 'jazariyyah', 'salsabil', 'tuhfah'];

export const MatnPages = TaPages.filter((page) => MatnSlugs.includes(page.slug));

export const PlayerPage: TaPage = AllPages.find((page) => page.slug === 'tuhfah') ?? AllPages[0];

export const MushafPage: TaPage = AllPages.find((page) => page.slug === 'mushaf') ?? AllPages[0];
