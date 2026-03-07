import { getYaLang } from '@/pages/parkingTypes';

type Lang = 'ru' | 'en' | 'tr' | 'be' | 'kk' | 'uk';

const translations: Record<string, Record<Lang, string>> = {
  'play': { ru: '🚀 ИГРАТЬ', en: '🚀 PLAY', tr: '🚀 OYNA', be: '🚀 ГУЛЯЦЬ', kk: '🚀 ОЙНА', uk: '🚀 ГРАТИ' },
  'garage': { ru: '🔧 Гараж', en: '🔧 Garage', tr: '🔧 Garaj', be: '🔧 Гараж', kk: '🔧 Гараж', uk: '🔧 Гараж' },
  'shop': { ru: '🛒 Магазин', en: '🛒 Shop', tr: '🛒 Mağaza', be: '🛒 Краму', kk: '🛒 Дүкен', uk: '🛒 Магазин' },
  'profile': { ru: '👤 Профиль', en: '👤 Profile', tr: '👤 Profil', be: '👤 Профіль', kk: '👤 Профиль', uk: '👤 Профіль' },
  'leaderboard': { ru: '🏆 Топ игроков', en: '🏆 Leaderboard', tr: '🏆 Liderler', be: '🏆 Топ', kk: '🏆 Рейтинг', uk: '🏆 Рейтинг' },
  'friends': { ru: '👥 Друзья', en: '👥 Friends', tr: '👥 Arkadaşlar', be: '👥 Сябры', kk: '👥 Достар', uk: '👥 Друзі' },
  'friends_bonus': { ru: '+10% монет при игре вместе', en: '+10% coins when playing together', tr: '+10% birlikte oynarken', be: '+10% манет разам', kk: '+10% бірге ойнасаң', uk: '+10% монет разом' },
  'exit': { ru: '← Выйти', en: '← Exit', tr: '← Çık', be: '← Выйсці', kk: '← Шығу', uk: '← Вийти' },
  'training': { ru: '🟢 Тренировка', en: '🟢 Training', tr: '🟢 Antrenman', be: '🟢 Трэніроўка', kk: '🟢 Жаттығу', uk: '🟢 Тренування' },
  'round': { ru: 'Раунд', en: 'Round', tr: 'Tur', be: 'Раунд', kk: 'Раунд', uk: 'Раунд' },
  'repair': { ru: '🔧 Починить', en: '🔧 Repair', tr: '🔧 Tamir', be: '🔧 Паправіць', kk: '🔧 Жөндеу', uk: '🔧 Полагодити' },
  'victory': { ru: 'ПОБЕДА!', en: 'VICTORY!', tr: 'ZAFERİ!', be: 'ПЕРАМОГА!', kk: 'ЖЕҢІС!', uk: 'ПЕРЕМОГА!' },
  'prize': { ru: 'ПРИЗЁР!', en: 'PRIZE!', tr: 'ÖDÜL!', be: 'ПРЫЗЁР!', kk: 'ЖҮЛДЕ!', uk: 'ПРИЗЁР!' },
  'win_desc': { ru: 'Ты лучший парковщик города!', en: 'You are the best parker in town!', tr: 'Şehrin en iyi park edeni!', be: 'Ты лепшы паркоўшчык!', kk: 'Сен ең жақсы жүргізушісің!', uk: 'Ти найкращий паркувальник!' },
  'play_again': { ru: '🔄 Снова играть', en: '🔄 Play again', tr: '🔄 Tekrar oyna', be: '🔄 Зноў', kk: '🔄 Қайта ойна', uk: '🔄 Знову грати' },
  'menu': { ru: '🏠 В меню', en: '🏠 Menu', tr: '🏠 Menü', be: '🏠 Меню', kk: '🏠 Мәзір', uk: '🏠 Меню' },
  'park_hint': { ru: 'Стрелки — движение · При сигнале «ПАРКУЙСЯ!» — займи свободное место', en: 'Arrows — move · On signal «PARK!» — take the free spot', tr: 'Oklar — hareket · «PARK ET!» sinyalinde boş yere git', be: 'Стрэлкі — рух', kk: 'Көрсеткіш — жүру', uk: 'Стрілки — рух' },
  'slot_machine': { ru: '🎰 Удача дня', en: '🎰 Daily luck', tr: '🎰 Günlük şans', be: '🎰 Удача дня', kk: '🎰 Күннің бақыты', uk: '🎰 Удача дня' },
  'daily_quests': { ru: '📋 Дневные', en: '📋 Daily', tr: '📋 Günlük', be: '📋 Дзённыя', kk: '📋 Күнделікті', uk: '📋 Денні' },
  'weekly_quests': { ru: '🏆 Недельные', en: '🏆 Weekly', tr: '🏆 Haftalık', be: '🏆 Тыднёвыя', kk: '🏆 Апталық', uk: '🏆 Тижневі' },
  'title': { ru: 'КОРОЛЬ ПАРКОВКИ', en: 'PARKING KING', tr: 'PARK KRALI', be: 'КАРОЛЬ ПАРКОЎКІ', kk: 'ПАРКИНГ ПАТШАСЫ', uk: 'КОРОЛЬ ПАРКУВАННЯ' },
  'subtitle': { ru: 'Захвати место — стань королём!', en: 'Take the spot — become the king!', tr: 'Yeri kap — kral ol!', be: 'Займі месца — стань каралём!', kk: 'Орынды ал — патша бол!', uk: 'Займи місце — стань королём!' },
};

let _lang: Lang = 'ru';

export function initI18n() {
  const yaLang = getYaLang();
  const supported: Lang[] = ['ru', 'en', 'tr', 'be', 'kk', 'uk'];
  _lang = (supported.includes(yaLang as Lang) ? yaLang : 'ru') as Lang;
  return _lang;
}

export function t(key: string): string {
  return translations[key]?.[_lang] ?? translations[key]?.['ru'] ?? key;
}

export function getLang(): Lang {
  return _lang;
}
