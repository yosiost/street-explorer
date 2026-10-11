import { normalizeName } from '../geo/names';
import type { Lang } from '../i18n';

/**
 * "Who is this street named after?": a short, hand-written list. OpenStreetMap rarely
 * says who a street is named after (no street in Kfar Saba has `name:etymology`), so these
 * are people whose names streets across Israel share, plus a few famous ones abroad.
 * Each `about` is one sentence a young kid can follow.
 */
export interface Namesake {
  emoji: string;
  /** The street's own name as it appears on signs, without "רחוב" / "Street". */
  keys: string[];
  he: { name: string; about: string };
  en: { name: string; about: string };
}

export const NAMESAKES: Namesake[] = [
  // --- Founders and leaders ---
  {
    emoji: '🔭',
    keys: ['הרצל', 'תאודור הרצל', 'בנימין זאב הרצל', 'Herzl', 'Theodor Herzl'],
    he: {
      name: 'בנימין זאב (תאודור) הרצל',
      about: 'חלם שיהיה לעם היהודי מדינה, הרבה לפני שהייתה.',
    },
    en: {
      name: 'Theodor Herzl',
      about: 'He dreamed of a country for the Jewish people, long before there was one.',
    },
  },
  {
    emoji: '🧪',
    keys: ['ויצמן', 'חיים ויצמן'],
    he: { name: 'חיים ויצמן', about: 'הנשיא הראשון של מדינת ישראל. הוא היה גם מדען, כימאי.' },
    en: { name: 'Chaim Weizmann', about: 'The first president of Israel. He was also a chemist.' },
  },
  {
    emoji: '📜',
    keys: ['בן גוריון', 'דוד בן גוריון'],
    he: {
      name: 'דוד בן־גוריון',
      about: 'ראש הממשלה הראשון. הוא הכריז על הקמת מדינת ישראל.',
    },
    en: {
      name: 'David Ben-Gurion',
      about: 'The first prime minister. He announced that the State of Israel was born.',
    },
  },
  {
    emoji: '🖋️',
    keys: ['ז׳בוטינסקי', 'זאב ז׳בוטינסקי'],
    he: { name: 'זאב ז׳בוטינסקי', about: 'מנהיג ציוני, סופר ומשורר, שכתב בהרבה שפות.' },
    en: { name: 'Ze’ev Jabotinsky', about: 'A Zionist leader and a writer of books and poems.' },
  },
  {
    emoji: '🏡',
    keys: ['רוטשילד', 'הברון רוטשילד', 'הנדיב'],
    he: {
      name: 'הברון אדמונד דה רוטשילד',
      about: 'עזר להקים הרבה מושבות בארץ, וקראו לו „הנדיב הידוע”.',
    },
    en: {
      name: 'Baron Edmond de Rothschild',
      about: 'He helped build many villages in the Land of Israel.',
    },
  },
  {
    emoji: '🎓',
    keys: ['נורדאו', 'מקס נורדאו'],
    he: { name: 'מקס נורדאו', about: 'רופא וסופר, חבר של הרצל, שעזר לו להקים את התנועה הציונית.' },
    en: {
      name: 'Max Nordau',
      about: 'A doctor and writer, Herzl’s friend, who helped him start the Zionist movement.',
    },
  },
  {
    emoji: '📰',
    keys: ['סוקולוב', 'נחום סוקולוב'],
    he: {
      name: 'נחום סוקולוב',
      about: 'עיתונאי ומנהיג ציוני. הוא נתן לעיר תל אביב את השם שלה.',
    },
    en: {
      name: 'Nahum Sokolow',
      about: 'A journalist and Zionist leader. He gave the city of Tel Aviv its name.',
    },
  },
  {
    emoji: '🗣️',
    keys: ['בן יהודה', 'אליעזר בן יהודה'],
    he: {
      name: 'אליעזר בן־יהודה',
      about: 'החזיר את העברית להיות שפה שמדברים בה כל יום, וכתב מילון גדול.',
    },
    en: {
      name: 'Eliezer Ben-Yehuda',
      about: 'He brought Hebrew back as an everyday language and wrote a big dictionary.',
    },
  },
  {
    emoji: '✉️',
    keys: ['בלפור', 'Balfour'],
    he: {
      name: 'לורד ארתור בלפור',
      about: 'שר בריטי שהבטיח ב־1917 בית לאומי לעם היהודי בארץ ישראל.',
    },
    en: {
      name: 'Lord Arthur Balfour',
      about: 'A British minister who promised the Jewish people a homeland in 1917.',
    },
  },
  {
    emoji: '🇺🇸',
    keys: ['טרומן', 'הארי טרומן', 'Truman'],
    he: {
      name: 'הארי טרומן',
      about: 'נשיא ארצות הברית. הוא הכיר במדינת ישראל דקות אחרי שקמה.',
    },
    en: {
      name: 'Harry Truman',
      about: 'A US president. He recognized Israel minutes after it was born.',
    },
  },
  {
    emoji: '🏛️',
    keys: ['משה שרת'],
    he: { name: 'משה שרת', about: 'שר החוץ הראשון של ישראל, ואחר כך ראש הממשלה השני.' },
    en: {
      name: 'Moshe Sharett',
      about: 'Israel’s first foreign minister, and later its second prime minister.',
    },
  },
  {
    emoji: '🏛️',
    keys: ['לוי אשכול'],
    he: { name: 'לוי אשכול', about: 'ראש הממשלה השלישי של ישראל.' },
    en: { name: 'Levi Eshkol', about: 'Israel’s third prime minister.' },
  },
  {
    emoji: '🕊️',
    keys: ['מנחם בגין'],
    he: { name: 'מנחם בגין', about: 'ראש ממשלה שעשה שלום עם מצרים וזכה בפרס נובל לשלום.' },
    en: {
      name: 'Menachem Begin',
      about: 'A prime minister who made peace with Egypt and won the Nobel Peace Prize.',
    },
  },
  {
    emoji: '🕊️',
    keys: ['רבין', 'יצחק רבין'],
    he: { name: 'יצחק רבין', about: 'רמטכ״ל וראש ממשלה, שזכה בפרס נובל לשלום.' },
    en: {
      name: 'Yitzhak Rabin',
      about: 'An army chief and prime minister who won the Nobel Peace Prize.',
    },
  },
  {
    emoji: '👩‍⚖️',
    keys: ['גולדה מאיר', 'גולדה'],
    he: { name: 'גולדה מאיר', about: 'האישה הראשונה שהייתה ראש ממשלה בישראל.' },
    en: { name: 'Golda Meir', about: 'The first woman to be prime minister of Israel.' },
  },
  {
    emoji: '🏛️',
    keys: ['שפרינצק', 'יוסף שפרינצק'],
    he: { name: 'יוסף שפרינצק', about: 'יושב ראש הכנסת הראשון.' },
    en: { name: 'Yosef Sprinzak', about: 'The first speaker of Israel’s parliament, the Knesset.' },
  },
  {
    emoji: '🏛️',
    keys: ['בן צבי', 'יצחק בן צבי'],
    he: { name: 'יצחק בן־צבי', about: 'הנשיא השני של מדינת ישראל.' },
    en: { name: 'Yitzhak Ben-Zvi', about: 'The second president of Israel.' },
  },
  {
    emoji: '🏙️',
    keys: ['דיזנגוף', 'מאיר דיזנגוף'],
    he: { name: 'מאיר דיזנגוף', about: 'ראש העיר הראשון של תל אביב.' },
    en: { name: 'Meir Dizengoff', about: 'The first mayor of Tel Aviv.' },
  },
  {
    emoji: '🌾',
    keys: ['רופין', 'ארתור רופין'],
    he: { name: 'ארתור רופין', about: 'עזר להקים הרבה יישובים, כמו דגניה ותל אביב.' },
    en: {
      name: 'Arthur Ruppin',
      about: 'He helped found many towns and villages, like Degania and Tel Aviv.',
    },
  },
  {
    emoji: '🌱',
    keys: ['גורדון', 'א.ד. גורדון', 'א״ד גורדון'],
    he: { name: 'אהרן דוד גורדון', about: 'האמין שעבודה באדמה, בשדה ובגינה, טובה לאדם.' },
    en: {
      name: 'A. D. Gordon',
      about: 'He believed working the land, in fields and gardens, is good for people.',
    },
  },
  {
    emoji: '🏥',
    keys: ['סולד', 'הנרייטה סולד'],
    he: {
      name: 'הנרייטה סולד',
      about: 'ייסדה את „הדסה” ועזרה להביא לארץ ולהציל אלפי ילדים.',
    },
    en: {
      name: 'Henrietta Szold',
      about: 'She founded Hadassah and helped bring thousands of children to safety in Israel.',
    },
  },
  {
    emoji: '🌾',
    keys: ['אהרונסון', 'אהרן אהרונסון'],
    he: { name: 'אהרן אהרונסון', about: 'מדען שגילה בארץ את „אם החיטה”, החיטה הפראית.' },
    en: { name: 'Aaron Aaronsohn', about: 'A scientist who discovered wild wheat in Israel.' },
  },
  {
    emoji: '📖',
    keys: ['בר אילן', 'מאיר בר אילן'],
    he: { name: 'הרב מאיר בר־אילן', about: 'רב ומנהיג ציוני. אוניברסיטת בר־אילן נקראת על שמו.' },
    en: {
      name: 'Rabbi Meir Bar-Ilan',
      about: 'A rabbi and Zionist leader. Bar-Ilan University is named after him.',
    },
  },
  {
    emoji: '📖',
    keys: ['הרב קוק', 'הראי״ה קוק', 'אברהם יצחק הכהן קוק'],
    he: { name: 'הרב אברהם יצחק הכהן קוק', about: 'הרב הראשי האשכנזי הראשון בארץ ישראל.' },
    en: {
      name: 'Rabbi Abraham Isaac Kook',
      about: 'The first Ashkenazi chief rabbi of the Land of Israel.',
    },
  },
  {
    emoji: '🧭',
    keys: ['קלישר', 'הרב קלישר'],
    he: { name: 'הרב צבי הירש קלישר', about: 'רב שקרא לחזור לארץ ישראל עוד לפני הרצל.' },
    en: {
      name: 'Rabbi Zvi Hirsch Kalischer',
      about: 'A rabbi who called on Jews to return to the Land of Israel, even before Herzl.',
    },
  },
  {
    emoji: '🧭',
    keys: ['אלקלעי', 'הרב אלקלעי'],
    he: { name: 'הרב יהודה אלקלעי', about: 'רב שקרא לחזור לארץ ישראל עוד לפני הרצל.' },
    en: {
      name: 'Rabbi Yehuda Alkalai',
      about: 'A rabbi who called on Jews to return to the Land of Israel, even before Herzl.',
    },
  },

  // --- Soldiers and heroes ---
  {
    emoji: '🛡️',
    keys: ['טרומפלדור', 'יוסף טרומפלדור'],
    he: { name: 'יוסף טרומפלדור', about: 'גיבור שהגן על תל חי בגליל.' },
    en: { name: 'Joseph Trumpeldor', about: 'A hero who defended Tel Hai in the Galilee.' },
  },
  {
    emoji: '🪂',
    keys: ['חנה סנש'],
    he: {
      name: 'חנה סנש',
      about: 'משוררת וצנחנית אמיצה. כתבה את השיר „הליכה לקיסריה” (אלי, אלי).',
    },
    en: {
      name: 'Hannah Szenes',
      about: 'A brave poet and paratrooper. She wrote the song “Eli, Eli”.',
    },
  },
  {
    emoji: '🪂',
    keys: ['חביבה רייך'],
    he: { name: 'חביבה רייך', about: 'צנחנית אמיצה שצנחה באירופה כדי לעזור ליהודים במלחמה.' },
    en: {
      name: 'Haviva Reik',
      about: 'A brave paratrooper who jumped into Europe to help Jews during the war.',
    },
  },
  {
    emoji: '✊',
    keys: ['אנילביץ׳', 'מרדכי אנילביץ׳'],
    he: { name: 'מרדכי אנילביץ׳', about: 'המפקד של מרד גטו ורשה, שנלחם נגד הנאצים.' },
    en: {
      name: 'Mordechai Anielewicz',
      about: 'The commander of the Warsaw Ghetto Uprising against the Nazis.',
    },
  },
  {
    emoji: '✊',
    keys: ['צביה לובטקין'],
    he: { name: 'צביה לובטקין', about: 'מהמנהיגות של מרד גטו ורשה נגד הנאצים.' },
    en: {
      name: 'Zivia Lubetkin',
      about: 'One of the leaders of the Warsaw Ghetto Uprising against the Nazis.',
    },
  },
  {
    emoji: '🗃️',
    keys: ['רינגלבלום', 'עמנואל רינגלבלום'],
    he: {
      name: 'עמנואל רינגלבלום',
      about: 'אסף והחביא מכתבים ומסמכים בגטו ורשה, כדי שהסיפור יישמר.',
    },
    en: {
      name: 'Emanuel Ringelblum',
      about: 'He collected and hid letters and papers in the Warsaw Ghetto so the story was kept.',
    },
  },
  {
    emoji: '🌲',
    keys: ['אבא קובנר'],
    he: { name: 'אבא קובנר', about: 'משורר שנלחם כפרטיזן ביערות נגד הנאצים.' },
    en: { name: 'Abba Kovner', about: 'A poet who fought the Nazis as a partisan in the forests.' },
  },
  {
    emoji: '🎖️',
    keys: ['משה דיין'],
    he: { name: 'משה דיין', about: 'רמטכ״ל ושר ביטחון, שהיה לו כיסוי על עין אחת.' },
    en: {
      name: 'Moshe Dayan',
      about: 'An army chief and defense minister who wore a patch over one eye.',
    },
  },
  {
    emoji: '🎖️',
    keys: ['דוד אלעזר'],
    he: { name: 'דוד אלעזר („דדו”)', about: 'הרמטכ״ל בזמן מלחמת יום הכיפורים.' },
    en: { name: 'David Elazar (“Dado”)', about: 'The army chief during the Yom Kippur War.' },
  },
  {
    emoji: '🐕',
    keys: ['מוטה גור', 'מרדכי גור'],
    he: {
      name: 'מוטה גור',
      about: 'מפקד הצנחנים במלחמת ששת הימים, שכתב גם ספרים לילדים על „עזית הכלבה הצנחנית”.',
    },
    en: {
      name: 'Motta Gur',
      about:
        'A paratrooper commander who also wrote children’s books about Azit the paratrooper dog.',
    },
  },
  {
    emoji: '🎖️',
    keys: ['עוזי נרקיס', 'האלוף עוזי נרקיס'],
    he: { name: 'עוזי נרקיס', about: 'אלוף שפיקד על הקרבות בירושלים במלחמת ששת הימים.' },
    en: {
      name: 'Uzi Narkiss',
      about: 'A general who led the battles for Jerusalem in the Six-Day War.',
    },
  },
  {
    emoji: '⛏️',
    keys: ['יגאל ידין'],
    he: { name: 'יגאל ידין', about: 'רמטכ״ל וארכיאולוג, שחפר במצדה ומצא שם אוצרות עתיקים.' },
    en: {
      name: 'Yigael Yadin',
      about: 'An army chief and archaeologist who dug at Masada and found ancient treasures.',
    },
  },
  {
    emoji: '🚀',
    keys: ['אילן רמון'],
    he: { name: 'אילן רמון', about: 'טייס, והאסטרונאוט הישראלי הראשון שטס לחלל.' },
    en: {
      name: 'Ilan Ramon',
      about: 'A pilot, and the first Israeli astronaut to fly into space.',
    },
  },

  // --- Writers, poets and songwriters ---
  {
    emoji: '📖',
    keys: ['ביאליק', 'חיים נחמן ביאליק'],
    he: {
      name: 'חיים נחמן ביאליק',
      about: '„המשורר הלאומי”. כתב גם הרבה שירים לילדים, כמו „שבת המלכה”.',
    },
    en: {
      name: 'Hayim Nahman Bialik',
      about: 'Israel’s “national poet”. He also wrote many poems for children.',
    },
  },
  {
    emoji: '🩺',
    keys: ['טשרניחובסקי', 'שאול טשרניחובסקי'],
    he: { name: 'שאול טשרניחובסקי', about: 'משורר שהיה גם רופא.' },
    en: { name: 'Shaul Tchernichovsky', about: 'A poet who was also a doctor.' },
  },
  {
    emoji: '✒️',
    keys: ['אחד העם'],
    he: { name: 'אחד העם', about: 'סופר שכתב בשם „אחד העם”. שמו האמיתי היה אשר גינצברג.' },
    en: {
      name: 'Ahad Ha’am',
      about: 'A writer whose pen name means “one of the people”. His real name was Asher Ginsberg.',
    },
  },
  {
    emoji: '🏅',
    keys: ['ש״י עגנון', 'עגנון'],
    he: { name: 'ש״י עגנון', about: 'סופר שזכה בפרס נובל לספרות, הישראלי הראשון שזכה בו.' },
    en: {
      name: 'S. Y. Agnon',
      about: 'A writer who won the Nobel Prize in Literature, the first Israeli to win it.',
    },
  },
  {
    emoji: '🌊',
    keys: ['רחל המשוררת'],
    he: { name: 'רחל המשוררת', about: 'משוררת שכתבה שירים על הכנרת, האגם שאהבה.' },
    en: {
      name: 'Rachel the Poet',
      about: 'A poet who wrote about the Sea of Galilee, which she loved.',
    },
  },
  {
    emoji: '🐶',
    keys: ['לאה גולדברג'],
    he: {
      name: 'לאה גולדברג',
      about: 'משוררת שכתבה ספרים לילדים, כמו „דירה להשכיר” ו„איה פלוטו”.',
    },
    en: {
      name: 'Leah Goldberg',
      about: 'A poet who wrote children’s books like “Apartment for Rent” and “Where Is Pluto?”.',
    },
  },
  {
    emoji: '🧙',
    keys: ['שלונסקי', 'אברהם שלונסקי'],
    he: { name: 'אברהם שלונסקי', about: 'משורר שכתב את „עוץ לי גוץ לי”.' },
    en: {
      name: 'Avraham Shlonsky',
      about: 'A poet who wrote the Hebrew version of Rumpelstiltskin.',
    },
  },
  {
    emoji: '🎭',
    keys: ['אלתרמן', 'נתן אלתרמן'],
    he: { name: 'נתן אלתרמן', about: 'משורר שכתב הרבה שירים ופזמונים, וגם ספרים לילדים.' },
    en: {
      name: 'Nathan Alterman',
      about: 'A poet who wrote many poems and songs, and books for children.',
    },
  },
  {
    emoji: '😄',
    keys: ['שלום עליכם'],
    he: { name: 'שלום עליכם', about: 'סופר שכתב ביידיש סיפורים מצחיקים, כמו „טוביה החולב”.' },
    en: {
      name: 'Sholem Aleichem',
      about: 'A writer of funny stories in Yiddish, like “Tevye the Dairyman”.',
    },
  },
  {
    emoji: '✒️',
    keys: ['י.ל. פרץ', 'י״ל פרץ', 'יצחק לייבוש פרץ'],
    he: { name: 'יצחק לייבוש פרץ', about: 'סופר שכתב סיפורים ביידיש ובעברית.' },
    en: { name: 'I. L. Peretz', about: 'A writer of stories in Yiddish and Hebrew.' },
  },
  {
    emoji: '❤️',
    keys: ['מאפו', 'אברהם מאפו'],
    he: { name: 'אברהם מאפו', about: 'כתב את „אהבת ציון”, הרומן הראשון בעברית.' },
    en: { name: 'Abraham Mapu', about: 'He wrote “The Love of Zion”, the first novel in Hebrew.' },
  },
  {
    emoji: '✒️',
    keys: ['ברנר', 'יוסף חיים ברנר'],
    he: { name: 'יוסף חיים ברנר', about: 'סופר עברי שכתב על החיים בארץ לפני יותר ממאה שנה.' },
    en: {
      name: 'Yosef Haim Brenner',
      about: 'A Hebrew writer who wrote about life in the Land of Israel over 100 years ago.',
    },
  },
  {
    emoji: '🎶',
    keys: ['אימבר', 'נפתלי הרץ אימבר'],
    he: { name: 'נפתלי הרץ אימבר', about: 'כתב את המילים של „התקווה”, ההמנון של ישראל.' },
    en: {
      name: 'Naftali Herz Imber',
      about: 'He wrote the words of “Hatikvah”, Israel’s national anthem.',
    },
  },
  {
    emoji: '🎵',
    keys: ['נעמי שמר'],
    he: { name: 'נעמי שמר', about: 'כתבה והלחינה הרבה שירים, כמו „ירושלים של זהב”.' },
    en: {
      name: 'Naomi Shemer',
      about: 'She wrote many songs, like “Jerusalem of Gold”.',
    },
  },
  {
    emoji: '🎵',
    keys: ['אהוד מנור'],
    he: { name: 'אהוד מנור', about: 'כתב מילים להרבה שירים, כמו „אין לי ארץ אחרת”.' },
    en: {
      name: 'Ehud Manor',
      about: 'He wrote the words of many songs, like “I Have No Other Country”.',
    },
  },
  {
    emoji: '🎹',
    keys: ['סשה ארגוב'],
    he: { name: 'סשה ארגוב', about: 'מלחין שכתב מנגינות להרבה שירים ישראליים.' },
    en: { name: 'Sasha Argov', about: 'A composer who wrote the music for many Israeli songs.' },
  },
  {
    emoji: '🎵',
    keys: ['עוזי חיטמן'],
    he: { name: 'עוזי חיטמן', about: 'כתב והלחין הרבה שירים, כמו „כאן”, וגם שירים לילדים.' },
    en: {
      name: 'Uzi Hitman',
      about: 'He wrote many songs, like “Kan” (“Here”), and songs for children.',
    },
  },
  {
    emoji: '🎵',
    keys: ['יאיר רוזנבלום'],
    he: { name: 'יאיר רוזנבלום', about: 'מלחין שכתב את המנגינה של „שיר לשלום”.' },
    en: { name: 'Yair Rosenblum', about: 'A composer who wrote the music of “A Song for Peace”.' },
  },
  {
    emoji: '🎤',
    keys: ['עפרה חזה'],
    he: { name: 'עפרה חזה', about: 'זמרת ישראלית שהשירים שלה התפרסמו בכל העולם.' },
    en: {
      name: 'Ofra Haza',
      about: 'An Israeli singer whose songs became famous around the world.',
    },
  },
  {
    emoji: '📔',
    keys: ['אנה פרנק'],
    he: { name: 'אנה פרנק', about: 'ילדה יהודייה שהתחבאה מהנאצים וכתבה יומן שכל העולם קורא.' },
    en: {
      name: 'Anne Frank',
      about: 'A Jewish girl who hid from the Nazis and wrote a diary the whole world reads.',
    },
  },
  {
    emoji: '❤️',
    keys: ['יאנוש קורצ׳אק', 'קורצ׳אק'],
    he: {
      name: 'יאנוש קורצ׳אק',
      about: 'רופא ומורה שדאג לילדים יתומים בוורשה ולא עזב אותם אף פעם.',
    },
    en: {
      name: 'Janusz Korczak',
      about: 'A doctor and teacher who cared for orphans in Warsaw and never left them.',
    },
  },

  // --- Scholars and scientists ---
  {
    emoji: '🧠',
    keys: ['אינשטיין', 'איינשטיין', 'אלברט איינשטיין', 'Einstein', 'Albert Einstein'],
    he: { name: 'אלברט איינשטיין', about: 'מדען גאון שגילה איך זמן, אור וכוח המשיכה עובדים.' },
    en: {
      name: 'Albert Einstein',
      about: 'A genius scientist who worked out how time, light and gravity work.',
    },
  },
  {
    emoji: '🌍',
    keys: ['זמנהוף', 'Zamenhof'],
    he: { name: 'לודוויג זמנהוף', about: 'רופא עיניים שהמציא שפה חדשה לכל העולם: אספרנטו.' },
    en: {
      name: 'L. L. Zamenhof',
      about: 'An eye doctor who invented a new language for the whole world: Esperanto.',
    },
  },
  {
    emoji: '📚',
    keys: ['גרץ', 'היינריך גרץ'],
    he: { name: 'היינריך גרץ', about: 'היסטוריון שכתב את כל ההיסטוריה של העם היהודי.' },
    en: {
      name: 'Heinrich Graetz',
      about: 'A historian who wrote the whole history of the Jewish people.',
    },
  },
  {
    emoji: '📚',
    keys: ['רש״י'],
    he: { name: 'רש״י (רבי שלמה יצחקי)', about: 'כתב הסברים לתורה ולתלמוד שלומדים עד היום.' },
    en: {
      name: 'Rashi',
      about: 'He wrote explanations of the Torah and Talmud that people still study today.',
    },
  },
  {
    emoji: '🩺',
    keys: ['רמב״ם', 'הרמב״ם'],
    he: {
      name: 'הרמב״ם (רבי משה בן מימון)',
      about: 'רב, פילוסוף ורופא חשוב, שחי לפני יותר מ־800 שנה.',
    },
    en: {
      name: 'Maimonides',
      about: 'A great rabbi, philosopher and doctor who lived over 800 years ago.',
    },
  },
  {
    emoji: '🎶',
    keys: ['יהודה הלוי', 'ריה״ל'],
    he: { name: 'רבי יהודה הלוי', about: 'משורר מספרד, לפני כמעט אלף שנה, שכתב „ליבי במזרח”.' },
    en: {
      name: 'Judah Halevi',
      about: 'A poet in Spain almost 1,000 years ago who wrote “My heart is in the East”.',
    },
  },
  {
    emoji: '🎶',
    keys: ['אבן גבירול', 'שלמה אבן גבירול'],
    he: { name: 'שלמה אבן גבירול', about: 'משורר מספרד שחי לפני כמעט אלף שנה.' },
    en: { name: 'Solomon ibn Gabirol', about: 'A poet in Spain almost 1,000 years ago.' },
  },
  {
    emoji: '🌟',
    keys: ['אבן עזרא', 'אברהם אבן עזרא'],
    he: { name: 'אברהם אבן עזרא', about: 'משורר, מסביר תורה וחוקר כוכבים מספרד.' },
    en: {
      name: 'Abraham ibn Ezra',
      about: 'A poet, Torah teacher and star-gazer from Spain.',
    },
  },
  {
    emoji: '⛵',
    keys: ['אברבנאל', 'דון יצחק אברבנאל'],
    he: {
      name: 'דון יצחק אברבנאל',
      about: 'שר האוצר של מלך ספרד, שבחר לצאת עם היהודים כשגורשו ב־1492.',
    },
    en: {
      name: 'Don Isaac Abravanel',
      about:
        'The Spanish king’s treasurer, who chose to leave with the Jews when they were expelled in 1492.',
    },
  },

  // --- From the Bible and the sages ---
  {
    emoji: '👑',
    keys: ['דוד המלך'],
    he: { name: 'דוד המלך', about: 'הנער שניצח את גוליית הענק עם קלע, ואחר כך היה מלך.' },
    en: {
      name: 'King David',
      about: 'The boy who beat the giant Goliath with a sling, and later became king.',
    },
  },
  {
    emoji: '👑',
    keys: ['שלמה המלך'],
    he: { name: 'שלמה המלך', about: 'הבן של דוד, מלך חכם מאוד שבנה את בית המקדש הראשון.' },
    en: {
      name: 'King Solomon',
      about: 'David’s son, a very wise king who built the First Temple.',
    },
  },
  {
    emoji: '👑',
    keys: ['שאול המלך'],
    he: { name: 'שאול המלך', about: 'המלך הראשון של עם ישראל.' },
    en: { name: 'King Saul', about: 'The first king of the people of Israel.' },
  },
  {
    emoji: '👑',
    keys: ['ינאי המלך', 'אלכסנדר ינאי'],
    he: { name: 'אלכסנדר ינאי', about: 'מלך מבית החשמונאים, הנכדים של המכבים.' },
    en: {
      name: 'King Alexander Jannaeus',
      about: 'A Hasmonean king, a grandson of the Maccabees.',
    },
  },
  {
    emoji: '🎺',
    keys: ['גדעון'],
    he: { name: 'גדעון', about: 'שופט בתנ״ך שניצח עם 300 לוחמים, שופרות וכדים.' },
    en: {
      name: 'Gideon',
      about: 'A judge in the Bible who won with 300 fighters, horns and jars.',
    },
  },
  {
    emoji: '🌴',
    keys: ['דבורה הנביאה'],
    he: { name: 'דבורה הנביאה', about: 'נביאה ושופטת בתנ״ך, שישבה מתחת לעץ תמר ושפטה את העם.' },
    en: {
      name: 'Deborah the Prophetess',
      about: 'A prophet and judge in the Bible who sat under a palm tree to judge the people.',
    },
  },
  {
    emoji: '🕎',
    keys: ['יהודה המכבי'],
    he: { name: 'יהודה המכבי', about: 'מנהיג המכבים, הגיבור של סיפור חנוכה.' },
    en: {
      name: 'Judah Maccabee',
      about: 'The leader of the Maccabees, the hero of the Hanukkah story.',
    },
  },
  {
    emoji: '⚔️',
    keys: ['בר כוכבא'],
    he: { name: 'בר כוכבא', about: 'מנהיג שמרד נגד הרומאים לפני כמעט 1,900 שנה.' },
    en: {
      name: 'Bar Kokhba',
      about: 'A leader who rebelled against the Romans almost 1,900 years ago.',
    },
  },
  {
    emoji: '📜',
    keys: ['יהודה הנשיא', 'רבי יהודה הנשיא'],
    he: { name: 'רבי יהודה הנשיא', about: 'אסף וסידר את המשנה, ספר חשוב מאוד.' },
    en: {
      name: 'Rabbi Judah the Prince',
      about: 'He gathered and wrote down the Mishnah, a very important book.',
    },
  },
  {
    emoji: '❤️',
    keys: ['רבי עקיבא'],
    he: { name: 'רבי עקיבא', about: 'חכם שלימד: „ואהבת לרעך כמוך” זה הכלל הכי חשוב בתורה.' },
    en: {
      name: 'Rabbi Akiva',
      about: 'A sage who taught that “love your neighbor as yourself” is the Torah’s biggest rule.',
    },
  },
  {
    emoji: '🦶',
    keys: ['הלל', 'הלל הזקן'],
    he: { name: 'הלל הזקן', about: 'חכם סבלני שלימד את כל התורה „על רגל אחת”.' },
    en: {
      name: 'Hillel the Elder',
      about: 'A patient sage who taught the whole Torah “standing on one foot”.',
    },
  },
  {
    emoji: '👞',
    keys: ['יוחנן הסנדלר', 'רבי יוחנן הסנדלר'],
    he: { name: 'רבי יוחנן הסנדלר', about: 'חכם מימי המשנה, שעבד בתיקון נעליים.' },
    en: {
      name: 'Rabbi Yochanan the Shoemaker',
      about: 'A sage from the time of the Mishnah who made shoes.',
    },
  },
  {
    emoji: '🍷',
    keys: ['אליהו התשבי', 'אליהו הנביא'],
    he: { name: 'אליהו הנביא', about: 'נביא בתנ״ך. בליל הסדר שמים לו כוס יין ופותחים לו את הדלת.' },
    en: {
      name: 'Elijah the Prophet',
      about: 'A prophet in the Bible. At the Passover Seder a cup of wine waits for him.',
    },
  },
  {
    emoji: '🕊️',
    keys: ['ישעיהו', 'ישעיהו הנביא'],
    he: { name: 'ישעיהו הנביא', about: 'נביא שחלם על עולם בלי מלחמות, שבו גר זאב עם כבש.' },
    en: {
      name: 'Isaiah the Prophet',
      about: 'A prophet who dreamed of a world without war, where the wolf lives with the lamb.',
    },
  },
  {
    emoji: '🦴',
    keys: ['יחזקאל', 'יחזקאל הנביא'],
    he: { name: 'יחזקאל הנביא', about: 'נביא שראה בחזון עצמות יבשות שחוזרות לחיים.' },
    en: {
      name: 'Ezekiel the Prophet',
      about: 'A prophet who saw dry bones come back to life in a vision.',
    },
  },
  {
    emoji: '🐑',
    keys: ['עמוס', 'עמוס הנביא'],
    he: { name: 'עמוס הנביא', about: 'רועה צאן שהיה לנביא, ודרש לעזור לעניים.' },
    en: {
      name: 'Amos the Prophet',
      about: 'A shepherd who became a prophet and asked people to help the poor.',
    },
  },
  {
    emoji: '🧱',
    keys: ['נחמיה'],
    he: { name: 'נחמיה', about: 'בנה מחדש את החומות של ירושלים.' },
    en: { name: 'Nehemiah', about: 'He rebuilt the walls of Jerusalem.' },
  },
  {
    emoji: '🦁',
    keys: ['דניאל', 'דניאל הנביא'],
    he: { name: 'דניאל', about: 'גיבור בתנ״ך שנזרק לגוב האריות, והאריות לא פגעו בו.' },
    en: {
      name: 'Daniel',
      about:
        'A hero in the Bible who was thrown into the lions’ den, and the lions didn’t hurt him.',
    },
  },

  // --- Abroad ---
  {
    emoji: '🇺🇸',
    keys: ['Washington', 'George Washington'],
    he: { name: 'ג׳ורג׳ וושינגטון', about: 'הנשיא הראשון של ארצות הברית.' },
    en: { name: 'George Washington', about: 'The first president of the United States.' },
  },
  {
    emoji: '🎩',
    keys: ['Lincoln', 'Abraham Lincoln'],
    he: { name: 'אברהם לינקולן', about: 'נשיא ארצות הברית ששחרר את העבדים.' },
    en: { name: 'Abraham Lincoln', about: 'The US president who freed the slaves.' },
  },
  {
    emoji: '✊',
    keys: ['Martin Luther King', 'Martin Luther King Jr', 'MLK'],
    he: { name: 'מרטין לותר קינג', about: 'נלחם בלי אלימות כדי שכל האנשים יקבלו אותן זכויות.' },
    en: {
      name: 'Martin Luther King Jr.',
      about: 'He fought, without violence, for everyone to have the same rights.',
    },
  },
  {
    emoji: '⛵',
    keys: ['Hudson', 'Henry Hudson'],
    he: { name: 'הנרי הדסון', about: 'ימאי וחוקר שהפליג במעלה הנהר שקרוי היום על שמו.' },
    en: {
      name: 'Henry Hudson',
      about: 'A sailor and explorer who sailed up the river now named after him.',
    },
  },
  {
    emoji: '⛵',
    keys: ['קולומבוס', 'Columbus', 'Christopher Columbus', 'Colombo', 'Colón'],
    he: { name: 'כריסטופר קולומבוס', about: 'ימאי שהפליג מעבר לים הגדול והגיע לאמריקה.' },
    en: {
      name: 'Christopher Columbus',
      about: 'A sailor who crossed the ocean and reached the Americas.',
    },
  },
  {
    emoji: '🎭',
    keys: ['Shakespeare', 'William Shakespeare'],
    he: { name: 'ויליאם שייקספיר', about: 'הכותב המפורסם ביותר של מחזות בשפה האנגלית.' },
    en: { name: 'William Shakespeare', about: 'The most famous writer of plays in English.' },
  },
  {
    emoji: '🎻',
    keys: ['Mozart', 'Wolfgang Amadeus Mozart'],
    he: { name: 'וולפגנג אמדאוס מוצרט', about: 'מלחין שהתחיל לכתוב מוזיקה כשהיה ילד קטן.' },
    en: {
      name: 'Wolfgang Amadeus Mozart',
      about: 'A composer who started writing music as a little boy.',
    },
  },
  {
    emoji: '👸',
    keys: ['Princesse Grace', 'Grace Kelly'],
    he: { name: 'הנסיכה גרייס', about: 'שחקנית קולנוע אמריקאית שהתחתנה עם נסיך מונקו.' },
    en: {
      name: 'Princess Grace',
      about: 'An American film star who married the prince of Monaco.',
    },
  },
];

// --- Lookup ---

const HEBREW = /[֐-׿]/;
// Kinds of street on a sign: "שדרות בן גוריון" is still Ben-Gurion.
const HEBREW_PREFIX = /^(?:רחוב|שדרות|שד׳|דרך|סמטת|סמ׳|כיכר|משעול|מעלה|נתיב)\s+/;
const HEBREW_TITLE = /^(?:ד״ר|דר׳|פרופסור|פרופ׳|האלוף|אלוף)\s+/;
// Words that say what kind of street it is, or join a name ("Rue de la ..."), in a few languages.
const LATIN_NOISE = new Set(
  (
    'street st avenue ave road rd boulevard blvd place pl drive dr lane ln way square sq court ' +
    'ct terrace parkway pkwy jr the of strasse str platz allee weg gasse rue quai via viale ' +
    'piazza calle avenida plaza paseo de du des la le del di da von'
  ).split(' '),
);

/** The part of a street name that names a person, ready for lookup. */
export function namesakeKey(name: string): string {
  const n = normalizeName(name);
  if (HEBREW.test(n)) return n.replace(HEBREW_PREFIX, '').replace(HEBREW_TITLE, '');
  return n
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // é → e
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !LATIN_NOISE.has(w))
    .join(' ');
}

const INDEX = new Map<string, Namesake>();
for (const person of NAMESAKES) {
  for (const key of person.keys) INDEX.set(namesakeKey(key), person);
}

/** Who the street is named after, by any of its names; null when we don't know. */
export function findNamesake(street: {
  name: string;
  altNames?: Partial<Record<Lang, string>>;
}): Namesake | null {
  const names = [street.name, street.altNames?.he, street.altNames?.en];
  for (const name of names) {
    const hit = name && INDEX.get(namesakeKey(name));
    if (hit) return hit;
  }
  return null;
}
