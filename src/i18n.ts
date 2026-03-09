import { getYaLang } from '@/pages/parkingTypes';

type Lang = 'ru' | 'en';

const translations: Record<string, Record<Lang, string>> = {
  'play': { ru: '🚀 ИГРАТЬ', en: '🚀 PLAY' },
  'garage': { ru: '🔧 Гараж', en: '🔧 Garage' },
  'shop': { ru: '🛒 Магазин', en: '🛒 Shop' },
  'profile': { ru: '👤 Профиль', en: '👤 Profile' },
  'leaderboard': { ru: '🏆 Топ игроков', en: '🏆 Leaderboard' },
  'friends': { ru: '👥 Друзья', en: '👥 Friends' },
  'friends_bonus': { ru: '+10% монет при игре вместе', en: '+10% coins when playing together' },
  'exit': { ru: '← Выйти', en: '← Exit' },
  'training': { ru: '🟢 Тренировка', en: '🟢 Training' },
  'round': { ru: 'Раунд', en: 'Round' },
  'repair': { ru: '🔧 Починить', en: '🔧 Repair' },
  'victory': { ru: 'ПОБЕДА!', en: 'VICTORY!' },
  'prize': { ru: 'ПРИЗЁР!', en: 'PRIZE!' },
  'win_desc': { ru: 'Ты лучший парковщик города!', en: 'You are the best parker in town!' },
  'play_again': { ru: '🔄 Снова играть', en: '🔄 Play again' },
  'menu': { ru: '🏠 В меню', en: '🏠 Menu' },
  'park_hint': { ru: 'Стрелки — движение · При сигнале «ПАРКУЙСЯ!» — займи свободное место', en: 'Arrows — move · On signal «PARK!» — take the free spot' },
  'slot_machine': { ru: '🎰 Удача дня', en: '🎰 Daily luck' },
  'daily_quests': { ru: '📋 Дневные', en: '📋 Daily' },
  'weekly_quests': { ru: '🏆 Недельные', en: '🏆 Weekly' },
  'title': { ru: 'КОРОЛЬ ПАРКОВКИ', en: 'PARKING KING' },
  'subtitle': { ru: '', en: '' },
  'rarity_common':    { ru: 'Обычный',   en: 'Common'    },
  'rarity_rare':      { ru: 'Редкий',    en: 'Rare'      },
  'rarity_epic':      { ru: 'Эпик',      en: 'Epic'      },
  'rarity_legendary': { ru: 'Легенда',   en: 'Legendary' },
  'nick_empty':       { ru: 'Имя не может быть пустым', en: 'Name cannot be empty' },
  'nick_short':       { ru: 'Минимум 2 символа', en: 'At least 2 characters' },
  'nick_long':        { ru: 'Максимум 16 символов', en: 'Maximum 16 characters' },
  'place':            { ru: 'Место',    en: 'Place'   },
  'coins':            { ru: 'Монеты',   en: 'Coins'   },
  'gems':             { ru: 'Кристаллы', en: 'Gems'   },
  'not_bad':          { ru: 'Неплохо, тренируйся!', en: 'Not bad, keep training!' },
  'park_faster':      { ru: 'Паркуйся быстрее!', en: 'Park faster!' },
  'privacy_policy':   { ru: 'Политика конфиденциальности', en: 'Privacy Policy' },

  // Garage
  'garage_title':     { ru: '🔧 Гараж', en: '🔧 Garage' },
  'durability':       { ru: '❤️ Прочность', en: '❤️ Durability' },
  'armor':            { ru: '🛡️ Броня', en: '🛡️ Armor' },
  'speed':            { ru: '⚡ Скорость', en: '⚡ Speed' },
  'collection':       { ru: 'Коллекция', en: 'Collection' },
  'repair_car':       { ru: '🔨 Починить', en: '🔨 Repair' },
  'car_perfect':      { ru: '✅ Машина в идеальном состоянии', en: '✅ Car is in perfect condition' },
  'max_durability':   { ru: '✅ Макс. прочность', en: '✅ Max durability' },
  'max_armor':        { ru: '✅ Макс. броня', en: '✅ Max armor' },
  'max_speed':        { ru: '✅ Макс. скорость', en: '✅ Max speed' },
  'not_enough_coins': { ru: '❌ Недостаточно монет!', en: '❌ Not enough coins!' },
  'not_enough_gems':  { ru: '❌ Недостаточно кристаллов!', en: '❌ Not enough gems!' },
  'repaired_ok':      { ru: '✅ Машина отремонтирована!', en: '✅ Car repaired!' },

  // Shop
  'shop_title':       { ru: '🛒 Магазин', en: '🛒 Shop' },
  'tab_upgrades':     { ru: 'Улучшения', en: 'Upgrades' },
  'tab_consumables':  { ru: 'Расходники', en: 'Consumables' },
  'tab_coins':        { ru: 'Монеты', en: 'Coins' },
  'tab_gems':         { ru: 'Кристаллы', en: 'Gems' },
  'upgrade_duration': { ru: 'Действует 24 часа с момента покупки', en: 'Active 24 hours from purchase' },
  'consumables_note': { ru: 'Разовые предметы — тратятся сразу при использовании', en: 'Single-use items — consumed immediately on use' },
  'gems_ya_only':     { ru: '💡 Покупка кристаллов доступна в Яндекс Играх', en: '💡 Gem purchase available in Yandex Games' },
  'buy_ya_only':      { ru: '💎 Покупка доступна только в Яндекс Играх', en: '💎 Purchase available in Yandex Games only' },
  'payment_safe':     { ru: 'Оплата через Яндекс · Безопасно', en: 'Payment via Yandex · Secure' },
  'restore_ya_only':  { ru: '♻️ Восстановление доступно только в Яндекс Играх', en: '♻️ Restore available in Yandex Games only' },
  'restore_btn':      { ru: 'Восстановить покупки', en: 'Restore purchases' },
  'restoring':        { ru: 'Проверяю...', en: 'Checking...' },
  'paying':           { ru: 'Оплата...', en: 'Paying...' },
  'or':               { ru: 'или', en: 'or' },
  'car_full_health':  { ru: '❌ Машина уже в полном порядке!', en: '❌ Car is already at full health!' },
  'max_lives':        { ru: '❌ Максимум 3 жизни в запасе!', en: '❌ Maximum 3 extra lives in stock!' },
  'payment_error':    { ru: '❌ Ошибка оплаты. Попробуй позже', en: '❌ Payment error. Try again later' },

  // Upgrade names & descriptions
  'upg_nitro':        { ru: 'Нитро-ускорение', en: 'Nitro boost' },
  'upg_nitro_desc':   { ru: 'Зажми Space — рывок +40% скорости', en: 'Hold Space — speed burst +40%' },
  'upg_gps':          { ru: 'GPS-радар', en: 'GPS Radar' },
  'upg_gps_desc':     { ru: 'Стрелка к ближайшему свободному месту', en: 'Arrow to nearest free spot' },
  'upg_bumper':       { ru: 'Усиленный бампер', en: 'Reinforced bumper' },
  'upg_bumper_desc':  { ru: '-30% урона при столкновениях', en: '-30% collision damage' },
  'upg_autorepair':   { ru: 'Авто-ремонт', en: 'Auto-repair' },
  'upg_autorepair_desc': { ru: '+15 HP после каждого раунда', en: '+15 HP after each round' },
  'upg_magnet':       { ru: 'Магнит парковки', en: 'Parking magnet' },
  'upg_magnet_desc':  { ru: 'Притягивает к месту в радиусе 50px', en: 'Pulls to spot within 50px' },
  'upg_turbo':        { ru: 'Турбо-старт', en: 'Turbo start' },
  'upg_turbo_desc':   { ru: 'После сигнала мгновенный разгон x2 на 2 сек', en: 'After signal instant x2 acceleration for 2 sec' },
  'upg_shield':       { ru: 'Силовое поле', en: 'Force shield' },
  'upg_shield_desc':  { ru: 'Первый удар за раунд — без урона', en: 'First hit per round — no damage' },
  'tag_hit':          { ru: 'ХИТ', en: 'HIT' },
  'tag_top':          { ru: 'ТОП', en: 'TOP' },

  // Consumables
  'cons_repair_s':    { ru: 'Ремкомплект S', en: 'Repair Kit S' },
  'cons_repair_s_desc': { ru: 'Восстанавливает 30 HP текущей машине', en: 'Restores 30 HP to current car' },
  'cons_repair_xl':   { ru: 'Ремкомплект XL', en: 'Repair Kit XL' },
  'cons_repair_xl_desc': { ru: 'Полностью восстанавливает HP машины', en: 'Fully restores car HP' },
  'cons_coinboost':   { ru: 'Монетный буст x2', en: 'Coin boost x2' },
  'cons_coinboost_desc': { ru: 'Удваивает монеты с игр на 3 сеанса', en: 'Doubles coins for 3 games' },
  'cons_extralife':   { ru: 'Вторая жизнь', en: 'Extra life' },
  'cons_extralife_desc': { ru: 'Продолжить игру после выбывания (1 раз)', en: 'Continue after elimination (1 time)' },
  'cons_xpboost':     { ru: 'Буст опыта x2', en: 'XP boost x2' },
  'cons_xpboost_desc': { ru: 'Двойной XP за следующие 5 игр', en: 'Double XP for next 5 games' },

  // Profile
  'profile_games':    { ru: 'Игр сыграно', en: 'Games played' },
  'profile_wins':     { ru: 'Побед', en: 'Wins' },
  'profile_best':     { ru: 'Лучшее место', en: 'Best place' },
  'profile_coins':    { ru: 'Монет', en: 'Coins' },
  'achievements_btn': { ru: 'Достижения', en: 'Achievements' },
  'gem_history':      { ru: '💎 История покупок', en: '💎 Purchase history' },
  'friends_section':  { ru: '👥 Друзья', en: '👥 Friends' },
  'name_changed':     { ru: '✅ Имя изменено!', en: '✅ Name changed!' },

  // Achievements
  'ach_title':        { ru: '🏅 Достижения', en: '🏅 Achievements' },
  'ach_rewards':      { ru: '● Есть награды!', en: '● Rewards available!' },
  'ach_tab':          { ru: '🏅 Достижения', en: '🏅 Achievements' },
  'level_rewards':    { ru: '📈 Награды за уровни', en: '📈 Level rewards' },
  'level_rewards_note': { ru: 'Награды начисляются автоматически при достижении уровня', en: 'Rewards are granted automatically on level up' },
  'claim':            { ru: 'Забрать!', en: 'Claim!' },

  // Achievement categories
  'cat_wins':         { ru: 'Победы', en: 'Wins' },
  'cat_games':        { ru: 'Игры', en: 'Games' },
  'cat_skills':       { ru: 'Скиллы', en: 'Skills' },
  'cat_wealth':       { ru: 'Богатство', en: 'Wealth' },
  'cat_garage':       { ru: 'Гараж', en: 'Garage' },
  'cat_levels':       { ru: 'Уровни', en: 'Levels' },
  'cat_streak':       { ru: 'Серия', en: 'Streak' },

  // Leaderboard
  'leaderboard_title': { ru: '🏆 Топ игроков', en: '🏆 Leaderboard' },
  'friends_title':    { ru: '👥 Друзья', en: '👥 Friends' },
  'wins_label':       { ru: 'побед', en: 'wins' },
  'loading':          { ru: 'Данные загружаются...', en: 'Loading data...' },

  // Daily bonus
  'daily_bonus_title': { ru: 'Ежедневный бонус!', en: 'Daily bonus!' },
  'daily_streak_max': { ru: 'Стрик 7 дней — максимальная награда!', en: '7-day streak — maximum reward!' },
  'daily_streak_tip': { ru: 'Заходи каждый день за всё большей наградой', en: 'Come back every day for bigger rewards' },
  'daily_collect':    { ru: 'Забрать!', en: 'Collect!' },
  'streak_label':     { ru: 'Стрик', en: 'Streak' },
  'streak_day':       { ru: 'день', en: 'day' },
  'streak_days_2_4':  { ru: 'дня', en: 'days' },
  'streak_days_5':    { ru: 'дней', en: 'days' },

  // Achievement toast
  'ach_toast_title':  { ru: '🏅 Достижение!', en: '🏅 Achievement!' },
  'ach_toast_claim':  { ru: 'забери в профиле', en: 'collect in profile' },

  // Game screen
  'brake':            { ru: 'ТОРМОЗ', en: 'BRAKE' },
  'nitro_btn':        { ru: 'НИТРО', en: 'NITRO' },
  'active_boosts':    { ru: 'Активные расходники', en: 'Active boosts' },
  'coin_boost_label': { ru: '💰 Буст монет x2', en: '💰 Coin boost x2' },
  'xp_boost_label':   { ru: '⭐ Буст XP x2', en: '⭐ XP boost x2' },
  'extra_lives_label': { ru: '❤️ Вторые жизни', en: '❤️ Extra lives' },
  'games_suffix':     { ru: 'игр', en: 'games' },
  'pcs_suffix':       { ru: 'шт.', en: 'pcs.' },
  'low_coins':        { ru: '❌ Мало монет!', en: '❌ Not enough coins!' },
  'eliminated':       { ru: '💀 Тебя вышибли!', en: '💀 You got eliminated!' },
  'use_extra_life':   { ru: 'Использовать вторую жизнь?', en: 'Use extra life?' },
  'has_pcs':          { ru: 'шт.', en: 'pcs.' },
  'continue_btn':     { ru: '❤️ Продолжить!', en: '❤️ Continue!' },
  'decline_btn':      { ru: 'Отказаться', en: 'Decline' },

  // Lobby tips
  'tip_achievements': { ru: 'Заходи в Достижения — там могут быть незабранные награды!', en: 'Check Achievements — there may be unclaimed rewards!' },
  'tip_nitro':        { ru: 'Нитро: зажми Space на клавиатуре или кнопку ⚡ на экране во время езды.', en: 'Nitro: hold Space on keyboard or tap ⚡ button on screen while driving.' },
  'tip_consumables':  { ru: 'Расходники в Магазине — буст монет x2 и XP x2 ускоряют прокачку.', en: 'Consumables in Shop — coin boost x2 and XP x2 speed up progress.' },
  'tip_extralife':    { ru: 'Вторая жизнь из Расходников спасёт, если тебя выбьют из раунда.', en: 'Extra life from Consumables saves you if eliminated from a round.' },
  'tip_magnet':       { ru: 'Магнит притягивает машину к месту парковки — удобно в финальных раундах.', en: 'Magnet pulls your car to a parking spot — handy in final rounds.' },
  'tip_shield':       { ru: 'Силовое поле поглощает первый удар за раунд — покупай против таранщиков.', en: 'Force shield absorbs the first hit per round — buy it against rammers.' },
  'tip_repair':       { ru: 'Ремонтируй машину в Гараже: с низким HP скорость заметно падает.', en: 'Repair your car in Garage: low HP noticeably reduces speed.' },
  'tip_friends':      { ru: 'Играй с другом — каждый из вас получит +10% монет за совместную игру.', en: 'Play with a friend — both of you get +10% coins for playing together.' },
  'tip_invite':       { ru: 'Пригласи друзей играть вместе — поделись ссылкой!', en: 'Invite friends to play together — share your link!' },
  'tip_gps':          { ru: 'GPS-радар показывает стрелку к ближайшему свободному месту.', en: 'GPS radar shows an arrow to the nearest free parking spot.' },
  'tip_turbo':        { ru: 'Турбо-старт даёт двойную скорость на 2 секунды после сигнала — врывайся первым!', en: 'Turbo start gives double speed for 2 seconds after signal — rush in first!' },
  'tip_daily':        { ru: 'Выполняй ежедневные задания — они обновляются каждый день.', en: 'Complete daily quests — they refresh every day.' },
  'tip_upgrades':     { ru: 'Прокачивай машины в Гараже: HP, броня и скорость открывают разные стили.', en: 'Upgrade cars in Garage: HP, armor and speed unlock different playstyles.' },
  'tip_gems':         { ru: 'Кристаллы выгоднее тратить на апгрейды в Магазине, чем менять на монеты.', en: 'Gems are better spent on upgrades in the Shop than exchanged for coins.' },
  'tip_win':          { ru: 'Победа в турнире — самый быстрый способ заработать монеты и XP.', en: 'Winning a tournament is the fastest way to earn coins and XP.' },
  'tip_add_friends':  { ru: 'Добавляй друзей — при совместной игре оба получают +20% монет и XP.', en: 'Add friends — both get +20% coins and XP when playing together.' },

  // Notify messages
  'notify_hp_up':        { ru: '✅ Прочность улучшена!', en: '✅ Durability upgraded!' },
  'notify_armor_up':     { ru: '✅ Броня улучшена!', en: '✅ Armor upgraded!' },
  'notify_speed_up':     { ru: '✅ Скорость улучшена!', en: '✅ Speed upgraded!' },
  'notify_restored':     { ru: '✅ Восстановлено', en: '✅ Restored' },
  'notify_no_pending':   { ru: 'ℹ️ Незавершённых покупок не найдено', en: 'ℹ️ No pending purchases found' },
  'notify_gems_recv':    { ru: '✅ Получено', en: '✅ Received' },
  'notify_upg_bought':   { ru: 'куплено на 24 часа!', en: 'purchased for 24 hours!' },
  'notify_repair_s':     { ru: '🔧 +30 HP восстановлено!', en: '🔧 +30 HP restored!' },
  'notify_repair_xl':    { ru: '🛠️ HP полностью восстановлено!', en: '🛠️ HP fully restored!' },
  'notify_coinboost':    { ru: '💰 Буст x2 активирован!', en: '💰 x2 boost activated!' },
  'notify_extralife':    { ru: '❤️ Вторая жизнь добавлена в запас!', en: '❤️ Extra life added to stock!' },
  'notify_xpboost':      { ru: '⭐ Буст опыта x2 на 5 игр!', en: '⭐ XP boost x2 for 5 games!' },
  'notify_name_changed': { ru: '✅ Имя изменено!', en: '✅ Name changed!' },
  'notify_car_bought':   { ru: '🎉 Куплен', en: '🎉 Bought' },
  'notify_repaired':     { ru: '✅ Машина отремонтирована!', en: '✅ Car repaired!' },
  'notify_restored_gems': { ru: 'из незавершённых покупок', en: 'from pending purchases' },
  'notify_repair_hp':    { ru: '🔧 HP восстановлено', en: '🔧 HP restored' },
  'notify_quest_done':   { ru: 'Задание выполнено!', en: 'Quest complete!' },
  'notify_weekly_done':  { ru: 'Недельное задание выполнено!', en: 'Weekly quest complete!' },
  'notify_ach_done':     { ru: 'Достижение разблокировано!', en: 'Achievement unlocked!' },

  // Friends panel
  'friends_my_code':     { ru: '🔑 Мой код', en: '🔑 My code' },
  'friends_add':         { ru: '+ Добавить', en: '+ Add' },
  'friends_add_title':   { ru: 'Добавить друга', en: 'Add friend' },
  'friends_code_hint':   { ru: 'Введи код друга', en: 'Enter friend code' },
  'friends_cancel':      { ru: 'Отмена', en: 'Cancel' },
  'friends_confirm':     { ru: 'Добавить', en: 'Add' },
  'friends_empty':       { ru: 'Нет друзей. Добавь по коду!', en: 'No friends yet. Add by code!' },
  'friends_online':      { ru: 'онлайн', en: 'online' },
  'friends_offline':     { ru: 'не в сети', en: 'offline' },
  'friends_err_short':   { ru: '❌ Введи код друга (минимум 6 символов)', en: '❌ Enter friend code (min 6 chars)' },
  'friends_err_self':    { ru: '❌ Нельзя добавить себя', en: '❌ Cannot add yourself' },
  'friends_err_already': { ru: '⚠️ Этот игрок уже в друзьях', en: '⚠️ This player is already your friend' },
  'friends_err_max':     { ru: '❌ Максимум 20 друзей', en: '❌ Maximum 20 friends' },
  'friends_err_conn':    { ru: '❌ Ошибка соединения', en: '❌ Connection error' },
  'friends_added':       { ru: 'добавлен в друзья! Играйте вместе — бонус +10% монет', en: 'added as friend! Play together — +10% coins bonus' },
  'friends_search_title': { ru: 'Поиск игроков', en: 'Player search' },
  'friends_search_hint':  { ru: 'Введи имя игрока...', en: 'Enter player name...' },
  'friends_search_btn':   { ru: 'Найти', en: 'Find' },
  'friends_not_found':    { ru: 'Игрок не найден', en: 'Player not found' },
  'friends_wins':         { ru: 'побед', en: 'wins' },
  'friends_games':        { ru: 'игр', en: 'games' },

  // Profile screen
  'profile_title':       { ru: '👤 Профиль', en: '👤 Profile' },
  'profile_level':       { ru: 'Уровень', en: 'Level' },
  'profile_xp':          { ru: 'Опыт', en: 'XP' },
  'profile_avatar':      { ru: 'Аватар', en: 'Avatar' },
  'profile_save':        { ru: '💾 Сохранить', en: '💾 Save' },
  'profile_edit_name':   { ru: 'Изменить имя', en: 'Change name' },
  'profile_stats':       { ru: 'Статистика', en: 'Stats' },
  'profile_no_history':  { ru: 'Покупок ещё нет', en: 'No purchases yet' },

  // Shop bonus label
  'bonus_label':         { ru: 'Бонус', en: 'Bonus' },
  'popular_label':       { ru: 'Популярное', en: 'Popular' },
  'coins_received':      { ru: 'монет', en: 'coins' },

  // Race / Game screen
  'park_signal':         { ru: 'ПАРКУЙСЯ!', en: 'PARK!' },
  'round_label':         { ru: 'Раунд', en: 'Round' },
  'waiting':             { ru: 'Ожидание...', en: 'Waiting...' },
  'players_label':       { ru: 'игроков', en: 'players' },
  'place_label':         { ru: 'Место', en: 'Place' },
  'coins_earned':        { ru: 'монет заработано', en: 'coins earned' },
  'xp_earned':           { ru: 'XP', en: 'XP' },
  'game_over_title':     { ru: 'Игра окончена', en: 'Game over' },
  'tip_label':           { ru: 'Совет', en: 'Tip' },
  'cancel_btn':          { ru: 'Отмена', en: 'Cancel' },
  'weekly_quests_start': { ru: 'Начни играть — задания появятся!', en: 'Start playing — quests will appear!' },

  // Garage notify
  'notify_hp_upgraded':    { ru: '+{val} HP к прочности!', en: '+{val} HP to durability!' },
  'notify_armor_upgraded': { ru: '+{val} к броне!', en: '+{val} to armor!' },
  'notify_speed_upgraded': { ru: '+{val} к скорости!', en: '+{val} to speed!' },

  // Rewarded ad
  'rewarded_btn':    { ru: '📺 Реклама +100 монет', en: '📺 Watch ad +100 coins' },
  'rewarded_ok':     { ru: '✅ +100 монет за рекламу!', en: '✅ +100 coins for watching!' },
  'rewarded_skip':   { ru: 'Реклама недоступна', en: 'Ad not available' },
  'rewarded_loading': { ru: '⏳ Загрузка...', en: '⏳ Loading...' },
};

let _lang: Lang = 'ru';

export function initI18n() {
  const yaLang = getYaLang();
  const supported: Lang[] = ['ru', 'en'];
  _lang = (supported.includes(yaLang as Lang) ? yaLang : 'ru') as Lang;
  return _lang;
}

export function t(key: string): string {
  return translations[key]?.[_lang] ?? translations[key]?.['ru'] ?? key;
}

export function getLang(): Lang {
  return _lang;
}