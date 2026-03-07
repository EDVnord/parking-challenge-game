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
  'subtitle': { ru: '', en: '', tr: '', be: '', kk: '', uk: '' },
  'rarity_common':    { ru: 'Обычный',   en: 'Common',    tr: 'Normal',  be: 'Звычайны', kk: 'Жай',     uk: 'Звичайний' },
  'rarity_rare':      { ru: 'Редкий',    en: 'Rare',      tr: 'Nadir',   be: 'Рэдкі',    kk: 'Сирек',   uk: 'Рідкісний' },
  'rarity_epic':      { ru: 'Эпик',      en: 'Epic',      tr: 'Destansı',be: 'Эпічны',   kk: 'Эпикалы', uk: 'Епічний'   },
  'rarity_legendary': { ru: 'Легенда',   en: 'Legendary', tr: 'Efsane',  be: 'Легенда',  kk: 'Аңыз',    uk: 'Легенда'   },
  'nick_empty':       { ru: 'Имя не может быть пустым', en: 'Name cannot be empty', tr: 'İsim boş olamaz', be: 'Імя не можа быць пустым', kk: 'Аты бос болмасын', uk: "Ім'я не може бути порожнім" },
  'nick_short':       { ru: 'Минимум 2 символа', en: 'At least 2 characters', tr: 'En az 2 karakter', be: 'Мінімум 2 сімвалы', kk: 'Кемінде 2 таңба', uk: 'Мінімум 2 символи' },
  'nick_long':        { ru: 'Максимум 16 символов', en: 'Maximum 16 characters', tr: 'En fazla 16 karakter', be: 'Максімум 16 сімвалаў', kk: 'Ең көбі 16 таңба', uk: 'Максимум 16 символів' },
  'place':            { ru: 'Место',    en: 'Place',   tr: 'Sıra',   be: 'Месца',  kk: 'Орын',    uk: 'Місце'   },
  'coins':            { ru: 'Монеты',   en: 'Coins',   tr: 'Paralar',be: 'Манеты', kk: 'Монеталар',uk: 'Монети' },
  'not_bad':          { ru: 'Неплохо, тренируйся!', en: 'Not bad, keep training!', tr: 'Fena değil, antrenman yap!', be: 'Нядрэнна, трэніруйся!', kk: 'Жаман емес, жаттыққа!', uk: 'Непогано, тренуйся!' },
  'park_faster':      { ru: 'Паркуйся быстрее!', en: 'Park faster!', tr: 'Daha hızlı park et!', be: 'Паркуйся хутчэй!', kk: 'Тезірек паркта!', uk: 'Паркуйся швидше!' },
  'privacy_policy':   { ru: 'Политика конфиденциальности', en: 'Privacy Policy', tr: 'Gizlilik Politikası', be: 'Палітыка прыватнасці', kk: 'Құпиялылық саясаты', uk: 'Політика конфіденційності' },
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