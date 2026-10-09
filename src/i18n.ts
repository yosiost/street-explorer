import type { Orientation } from './geo/orientation';

export type Lang = 'he' | 'en';
export type Side = 'red' | 'blue';

/** Every user-facing string, in Hebrew and English. `en` must match `he` key for key. */
const he = {
  appTitle: 'חוקרי הרחובות',
  appDescription: 'בוחרים עיר ורואים את כל הרחובות שלה, מהארוך לקצר',
  switchTo: 'English',
  switchToLabel: 'Switch to English',

  // Picker
  pickCity: 'בחרו עיר',
  cities: 'ערים',
  loadingCities: 'טוען ערים…',
  mapIt: 'הצג במפה',
  showRegional: 'כולל מועצות אזוריות',
  noCity: 'לא נמצאה עיר',
  worldHeading: 'בעולם',
  searching: 'מחפשים…',
  searchFailed: 'החיפוש לא הצליח. נסו שוב בעוד רגע.',
  noPlace: 'לא נמצא מקום בשם הזה',
  searchWorld: (q: string) => `חיפוש ״${q}״ בכל העולם`,
  sizeLarge: 'עיר גדולה מאוד, ההורדה תיקח כמה דקות',
  sizeTooBig: 'גדולה מדי. חפשו רובע או שכונה שלה',

  // Loading and errors
  stepDownload: 'מורידים את גבול העיר והרחובות',
  stepCompute: 'מחשבים אורכים וכיוונים',
  busyRetrying: (secs: number) => `השרת עמוס, מנסים שוב… (${secs} שניות)`,
  waitLarge: (secs: number) => `${secs} שניות. זו עיר גדולה מאוד, זה יכול לקחת כמה דקות.`,
  waitNormal: (secs: number) => `${secs} שניות. בעיר גדולה זה יכול לקחת עד חצי דקה.`,
  cancel: 'ביטול',
  retry: 'נסו שוב',
  errorNetwork:
    'לא הצלחנו להוריד את הנתונים מ־OpenStreetMap. ייתכן שהשרתים עמוסים כרגע. נסו שוב בעוד דקה.',
  errorNetworkLarge:
    'לא הצלחנו להוריד את העיר. היא גדולה מאוד, ואולי השרתים עמוסים. נסו שוב, או חפשו רובע או שכונה שלה.',
  errorProcessing: 'משהו השתבש בעיבוד הנתונים של העיר הזו.',
  errorTooBig: 'העיר הזו גדולה מדי בשביל האפליקציה. חפשו רובע או שכונה שלה.',

  // List
  map: 'מפה',
  streetList: 'רשימת רחובות',
  sort: 'מיון',
  longestFirst: 'הכי ארוך קודם',
  shortestFirst: 'הכי קצר קודם',
  searchStreet: 'חיפוש רחוב',
  searchStreetPlaceholder: 'חיפוש רחוב…',
  pickPrompt: 'בחרו עיר ולחצו „הצג במפה״',
  summary: (count: string, km: string) => `${count} רחובות · ${km} ק״מ בסך הכול`,
  noStreetByName: 'אין רחוב בשם הזה',
  noNamedStreets:
    'לא מצאנו כאן רחובות עם שם ב־OpenStreetMap. יש מקומות, למשל ביפן, שבהם לרחובות אין שמות.',
  tinyTitle: 'קטע קצר מאוד, ייתכן שזו שארית מיפוי ולא רחוב שלם',
  ourStreet: 'הרחוב שלנו',
  startGame: '🎮 משחק: מה יותר ארוך?',

  // Lengths and orientation
  meters: (m: number) => `${m} מ׳`,
  km: (km: string) => `${km} ק״מ`,
  orientation: {
    'N-S': 'צפון–דרום',
    'NE-SW': 'צפון-מזרח – דרום-מערב',
    'E-W': 'מזרח–מערב',
    'NW-SE': 'צפון-מערב – דרום-מזרח',
    WINDING: 'מתפתל',
    BRANCHED: 'מסתעף',
  } satisfies Record<Orientation, string>,

  // Popup and kid comparisons
  length: 'אורך',
  direction: 'כיוון',
  segments: 'מקטעים במפה',
  readAloud: '🔊 הקראה',
  readAloudOff: '🔇 הקראה',
  isOurStreet: 'זה הרחוב שלנו!',
  setHome: '☆ זה הרחוב שלנו?',
  unsetHome: '⭐ זה הרחוב שלנו',
  setHomeTitle: 'כל הרחובות יושוו אליו',
  unsetHomeTitle: 'לחיצה מבטלת',
  ourStreetIs: (name: string) => `הרחוב שלנו: ${name}`,
  kidSteps: (n: string) => `בערך ${n} צעדים של ילד`,
  pitchesNone: 'פחות ממגרש כדורגל אחד',
  pitchesOne: 'כמו מגרש כדורגל אחד',
  pitches: (n: number) => `כמו ${n} מגרשי כדורגל`,
  homeTimes: (n: number) =>
    n === 2 ? 'כמו שני רחובות שלנו, אחד אחרי השני' : `כמו ${n} רחובות שלנו, אחד אחרי השני`,
  homeSame: 'בערך כמו הרחוב שלנו',
  homeHalf: 'בערך חצי מהרחוב שלנו',
  homeQuarter: 'בערך רבע מהרחוב שלנו',
  homeMuchShorter: 'הרבה יותר קצר מהרחוב שלנו',
  ratioLittle: 'קצת יותר ארוך',
  ratioTimes: (n: number) => `ארוך בערך פי ${n}`,

  // Read-aloud (no abbreviations: a voice would stumble on them)
  spokenMeters: (m: number) => `${m} מטר`,
  spokenKm: (km: string) => `${km} קילומטר`,
  spokenLength: (len: string) => `אורך ${len}`,
  spokenDirection: {
    'N-S': 'הולך מצפון לדרום',
    'E-W': 'הולך ממזרח למערב',
    'NE-SW': 'הולך מצפון-מזרח לדרום-מערב',
    'NW-SE': 'הולך מצפון-מערב לדרום-מזרח',
    WINDING: 'רחוב מתפתל',
    BRANCHED: 'רחוב שמתפצל לכמה כיוונים',
  } satisfies Record<Orientation, string>,
  spokenIsHome: 'וזה הרחוב שלנו!',
  spokenKidSteps: (n: number) => `בערך ${n} צעדים של ילד`,

  // Game
  gameTitle: 'מה יותר ארוך?',
  gameLabel: 'משחק: מה יותר ארוך?',
  gameHint: 'לחצו על הרחוב שנראה לכם ארוך יותר. אפשר גם על הקו במפה.',
  gameExit: 'סיום ✕',
  gameNext: 'עוד אחד ←',
  gameRound: (n: number) => `סיבוב ${n}`,
  gameScoreLabel: (n: number) => `${n} תשובות נכונות`,
  sideWord: { red: 'האדום', blue: 'הכחול' } satisfies Record<Side, string>,
  choiceLabel: (side: string, name: string) => `הרחוב ${side}: ${name}`,
  right: 'נכון! 🎉',
  almost: (side: string) => `כמעט! הרחוב ${side} ארוך יותר.`,
  spokenRight: 'נכון!',
  spokenQuestion: ['מה יותר ארוך? הרחוב האדום,', 'או הרחוב הכחול,'] as [string, string],
  praise: { 3: '3 ברצף! 🔥', 5: '5 ברצף! 🚀', 10: '10 ברצף! 👑' } as Record<number, string>,

  // Footer
  howTitle: 'איך אנחנו מודדים?',
  howBody1:
    'הנתונים מגיעים מ־OpenStreetMap, מפה שמתנדבים מציירים. רחוב הוא כל הקטעים בעיר שיש להם אותו שם. כשלשדרה יש שני מסלולים נפרדים, סופרים אותה פעם אחת. חלקים שיוצאים מגבול העיר לא נספרים, וכיכרות לא נכנסות לאורך.',
  howBody2:
    'המספרים טובים כמו המפה. לפעמים הם יוצאים בכמה עשרות מטרים יותר או פחות. רחובות קצרים מאוד מסומנים בנקודה, כי לפעמים הם רק שארית של מיפוי ולא רחוב אמיתי.',
  dataLabel: 'נתונים:',
  osmContributors: '© תורמי OpenStreetMap',
};

export type Strings = typeof he;

const en: Strings = {
  appTitle: 'Street Explorers',
  appDescription: 'Pick a city and see all of its streets, longest to shortest',
  switchTo: 'עברית',
  switchToLabel: 'החלפה לעברית',

  pickCity: 'Pick a city',
  cities: 'Cities',
  loadingCities: 'Loading cities…',
  mapIt: 'Show on map',
  showRegional: 'Include regional councils',
  noCity: 'No city found',
  worldHeading: 'Around the world',
  searching: 'Searching…',
  searchFailed: 'The search didn’t work. Try again in a moment.',
  noPlace: 'No place by that name',
  searchWorld: (q) => `Search the whole world for “${q}”`,
  sizeLarge: 'A very big city: the download takes a few minutes',
  sizeTooBig: 'Too big. Search for one of its districts',

  stepDownload: 'Downloading the city border and streets',
  stepCompute: 'Measuring lengths and directions',
  busyRetrying: (secs) => `The server is busy, trying again… (${secs} s)`,
  waitLarge: (secs) => `${secs} s. This is a very big city, it can take a few minutes.`,
  waitNormal: (secs) => `${secs} s. A big city can take up to half a minute.`,
  cancel: 'Cancel',
  retry: 'Try again',
  errorNetwork:
    'We couldn’t download the data from OpenStreetMap. The servers may be busy. Try again in a minute.',
  errorNetworkLarge:
    'We couldn’t download this city. It is very big, and the servers may be busy. Try again, or search for one of its districts.',
  errorProcessing: 'Something went wrong while measuring this city.',
  errorTooBig: 'This city is too big for the app. Search for one of its districts.',

  map: 'Map',
  streetList: 'Street list',
  sort: 'Sort',
  longestFirst: 'Longest first',
  shortestFirst: 'Shortest first',
  searchStreet: 'Find a street',
  searchStreetPlaceholder: 'Find a street…',
  pickPrompt: 'Pick a city and press “Show on map”',
  summary: (count, km) => `${count} streets · ${km} km in total`,
  noStreetByName: 'No street by that name',
  noNamedStreets:
    'We found no named streets here in OpenStreetMap. In some places, like Japan, streets have no names.',
  tinyTitle: 'A very short piece: it may be a mapping leftover, not a whole street',
  ourStreet: 'Our street',
  startGame: '🎮 Game: which is longer?',

  meters: (m) => `${m} m`,
  km: (km) => `${km} km`,
  orientation: {
    'N-S': 'North–South',
    'NE-SW': 'Northeast–Southwest',
    'E-W': 'East–West',
    'NW-SE': 'Northwest–Southeast',
    WINDING: 'Winding',
    BRANCHED: 'Branching',
  },

  length: 'Length',
  direction: 'Direction',
  segments: 'Map pieces',
  readAloud: '🔊 Read aloud',
  readAloudOff: '🔇 Read aloud',
  isOurStreet: 'This is our street!',
  setHome: '☆ Our street?',
  unsetHome: '⭐ Our street',
  setHomeTitle: 'Every street will be compared with it',
  unsetHomeTitle: 'Click to undo',
  ourStreetIs: (name) => `Our street: ${name}`,
  kidSteps: (n) => `About ${n} kid steps`,
  pitchesNone: 'Less than one football pitch',
  pitchesOne: 'Like one football pitch',
  pitches: (n) => `Like ${n} football pitches`,
  homeTimes: (n) => `Like ${n} of our street, end to end`,
  homeSame: 'About as long as our street',
  homeHalf: 'About half our street',
  homeQuarter: 'About a quarter of our street',
  homeMuchShorter: 'Much shorter than our street',
  ratioLittle: 'a little longer',
  ratioTimes: (n) => `about ${n} times longer`,

  spokenMeters: (m) => `${m} meters`,
  spokenKm: (km) => `${km} kilometers`,
  spokenLength: (len) => `${len} long`,
  spokenDirection: {
    'N-S': 'It goes from north to south',
    'E-W': 'It goes from east to west',
    'NE-SW': 'It goes from northeast to southwest',
    'NW-SE': 'It goes from northwest to southeast',
    WINDING: 'A winding street',
    BRANCHED: 'A street that branches in different directions',
  },
  spokenIsHome: 'And this is our street!',
  spokenKidSteps: (n) => `About ${n} kid steps`,

  gameTitle: 'Which is longer?',
  gameLabel: 'Game: which is longer?',
  gameHint: 'Tap the street you think is longer. You can also tap its line on the map.',
  gameExit: 'Done ✕',
  gameNext: 'Another one →',
  gameRound: (n) => `Round ${n}`,
  gameScoreLabel: (n) => `${n} right answers`,
  sideWord: { red: 'red', blue: 'blue' },
  choiceLabel: (side, name) => `The ${side} street: ${name}`,
  right: 'Right! 🎉',
  almost: (side) => `Almost! The ${side} street is longer.`,
  spokenRight: 'Right!',
  spokenQuestion: ['Which is longer? The red street,', 'or the blue street,'],
  praise: { 3: '3 in a row! 🔥', 5: '5 in a row! 🚀', 10: '10 in a row! 👑' },

  howTitle: 'How do we measure?',
  howBody1:
    'The data comes from OpenStreetMap, a map drawn by volunteers. A street is every piece in the city with the same name. When a boulevard has two separate roadways, it is counted once. Parts outside the city border don’t count, and roundabouts are left out.',
  howBody2:
    'The numbers are as good as the map. Sometimes they are off by a few dozen meters. Very short streets get a dot, because sometimes they are just a mapping leftover and not a real street.',
  dataLabel: 'Data:',
  osmContributors: '© OpenStreetMap contributors',
};

const STRINGS: Record<Lang, Strings> = { he, en };
const KEY = 'street-explorer:lang';

function initialLang(): Lang {
  const param = new URLSearchParams(globalThis.location?.search ?? '').get('lang');
  if (param === 'he' || param === 'en') return param;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'he' || saved === 'en') return saved;
  } catch {
    // Storage blocked: default below.
  }
  return 'he';
}

let current: Lang = typeof window === 'undefined' ? 'he' : initialLang();

export const getLang = (): Lang => current;
export const t = (): Strings => STRINGS[current];
export const stringsFor = (lang: Lang): Strings => STRINGS[lang];
/** BCP 47 locale for numbers and sorting. */
export const locale = (): string => (current === 'he' ? 'he' : 'en');

/** Switches language: remembered, sets <html lang dir>, and fills the static page text. */
export function setLang(lang: Lang) {
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // The choice lasts for this visit.
  }
  applyStaticText();
}

/**
 * Static text in index.html: `data-i18n="key"` sets textContent, and
 * `data-i18n-attr="placeholder:key aria-label:key"` sets attributes.
 */
export function applyStaticText(root?: ParentNode) {
  if (typeof document === 'undefined') return;
  root ??= document;
  const s = t() as unknown as Record<string, unknown>;
  document.documentElement.lang = current;
  document.documentElement.dir = current === 'he' ? 'rtl' : 'ltr';
  document.title = t().appTitle;
  document.querySelector('meta[name="description"]')?.setAttribute('content', t().appDescription);
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const v = s[el.dataset.i18n!];
    if (typeof v === 'string') el.textContent = v;
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr!.split(/\s+/)) {
      const [attr, key] = pair.split(':');
      const v = s[key!];
      if (attr && typeof v === 'string') el.setAttribute(attr, v);
    }
  });
}
