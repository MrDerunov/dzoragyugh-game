import type { EventDef, ObjectSpec, WeirdOutcome } from './types';

/** Каталог всех игровых объектов. Контент отделён от логики — легко персонализировать (геймдизайн §30). */
export const OBJECTS: ObjectSpec[] = [
  // ---- полезные: собирай ----
  { id: 'coffee', kind: 'good', label: 'սուրճ', emoji: '☕', score: 10, lifespanMs: 4000, weight: 1.2, eventWeights: { mamaMode: 2 }, reactions: ['Кофе найден', 'СИТУАЦИЯ СТАБИЛИЗИРОВАНА: найден кофе'] },
  { id: 'gata', kind: 'good', label: 'գաթա', emoji: '🥯', score: 15, lifespanMs: 4000, weight: 1.2, eventWeights: { mamaMode: 5 }, reactions: ['Գաթա спасена', 'ОБНАРУЖЕНА ԳԱԹԱ'] },
  { id: 'correct-answer', kind: 'good', label: 'ճիշտ պատասխան', emoji: '✅', score: 20, lifespanMs: 3500, weight: 0.9, reactions: ['Правильно! Деревня аплодирует', 'Учительница удивлена'] },
  { id: 'notebook', kind: 'good', label: 'տետր', emoji: '📓', score: 15, lifespanMs: 4000, weight: 0.9, reactions: ['Тетрадь на месте', 'Домашка существует'] },
  { id: 'book', kind: 'good', label: 'գիրք', emoji: '📖', score: 15, lifespanMs: 4000, weight: 0.8, reactions: ['Книга открыта', 'Знания найдены'] },
  { id: 'letter', kind: 'good', label: 'Ա', emoji: '🔤', score: 10, lifespanMs: 3500, weight: 1, reactions: ['Буква вернулась в алфавит', 'Ա спасена'] },
  { id: 'i-understand', kind: 'good', label: 'Ես հասկանում եմ', emoji: '💡', score: 20, lifespanMs: 3500, weight: 0.7, reactions: ['Понимание зафиксировано', 'Слово действительно запомнилось'] },
  { id: 'home-food', kind: 'good', label: 'домашняя еда', emoji: '🍲', score: 15, lifespanMs: 4000, weight: 0.8, eventWeights: { mamaMode: 5 }, reactions: ['Мама одобряет', 'Ещё порция. Конечно'] },
  { id: 'fruit', kind: 'good', label: 'фрукт', emoji: '🍎', score: 10, lifespanMs: 4000, weight: 0.8, eventWeights: { mamaMode: 4 }, reactions: ['Витамины спасены', 'Фрукт съеден. Мама довольна'] },
  { id: 'tea', kind: 'good', label: 'чай', emoji: '🫖', score: 10, lifespanMs: 4000, weight: 0.8, eventWeights: { mamaMode: 3 }, reactions: ['Чай выпит', 'Ситуация стабилизирована чаем'] },
  { id: 'rare-word', kind: 'good', label: 'հազվագյուտ բառ', emoji: '💎', score: 25, lifespanMs: 3000, weight: 0.6, reactions: ['Редкое слово применено', 'Грамматика в восторге'] },
  // ---- вредные: уничтожай ----
  { id: 'nu-tipa', kind: 'bad', label: 'ну типа', emoji: '🗣️', score: 10, lifespanMs: 3500, weight: 1.2, eventWeights: { russianInvasion: 5 }, reactions: ['РУСИЗМ УНИЧТОЖЕН', '«Ну типа» ликвидировано'] },
  { id: 'nu', kind: 'bad', label: 'ну', emoji: '🗣️', score: 10, lifespanMs: 3500, weight: 1, eventWeights: { russianInvasion: 5 }, reactions: ['РУСИЗМ УНИЧТОЖЕН', '«Ну» уничтожено'] },
  { id: 'koroche', kind: 'bad', label: 'короче', emoji: '🗣️', score: 10, lifespanMs: 3500, weight: 1, eventWeights: { russianInvasion: 5 }, reactions: ['РУСИЗМ УНИЧТОЖЕН', 'Короче, победа'] },
  { id: 'po-russki', kind: 'bad', label: 'а можно по-русски?', emoji: '🇷🇺', score: 15, lifespanMs: 3500, weight: 0.8, eventWeights: { russianInvasion: 4 }, reactions: ['Русский отброшен', 'По-армянски, пожалуйста'] },
  { id: 'wrong-ending', kind: 'bad', label: 'неправильное окончание', emoji: '✖️', score: 15, lifespanMs: 3500, weight: 1, reactions: ['Окончание исправлено', 'Падеж спасён'] },
  { id: 'no-homework', kind: 'bad', label: 'пропущенная домашка', emoji: '📵', score: 15, lifespanMs: 3500, weight: 0.8, reactions: ['Домашка восстановлена', 'Оправдание отклонено'] },
  { id: 'telegram', kind: 'bad', label: 'Telegram на уроке', emoji: '📱', score: 10, lifespanMs: 3500, weight: 0.8, eventWeights: { russianInvasion: 2 }, reactions: ['Телефон убран', 'Урок важнее'] },
  { id: 'i-knew-it', kind: 'bad', label: 'я это точно учил', emoji: '🤔', score: 10, lifespanMs: 3500, weight: 0.8, eventWeights: { russianInvasion: 3 }, reactions: ['Учил — значит помни', 'Память допрошена'] },
  { id: 'did-we-cover', kind: 'bad', label: 'мы это проходили?', emoji: '❓', score: 10, lifespanMs: 3500, weight: 0.8, eventWeights: { russianInvasion: 3 }, reactions: ['Проходили. Дважды', 'Вопрос закрыт'] },
  { id: 'google-translate', kind: 'bad', label: 'Google Translate', emoji: '🔄', score: 10, lifespanMs: 3500, weight: 0.7, eventWeights: { russianInvasion: 3 }, reactions: ['Переводчик закрыт', 'Своими словами, пожалуйста'] },
  { id: 'phone', kind: 'bad', label: 'звонок во время урока', emoji: '📞', score: 10, lifespanMs: 3500, weight: 0.7, reactions: ['Звонок сброшен', 'На уроке не звонят'] },
  // ---- странные: на свой страх и риск ----
  { id: 'sheep', kind: 'weird', label: 'ոչխար', emoji: '🐑', score: 0, lifespanMs: 3500, weight: 1.3, eventWeights: { sheepChaos: 10 }, reactions: ['Овца подозрительно смотрит.'] },
  { id: 'cat', kind: 'weird', label: 'кот', emoji: '🐈', score: 0, lifespanMs: 3500, weight: 0.8, eventWeights: { sheepChaos: 2 }, reactions: ['Кот смотрит с осуждением.'] },
  { id: 'neighbor', kind: 'weird', label: 'сосед', emoji: '🧔', score: 0, lifespanMs: 3500, weight: 0.7, reactions: ['Сосед пришёл посмотреть.'] },
  { id: 'tractor', kind: 'weird', label: 'трактор', emoji: '🚜', score: 0, lifespanMs: 3500, weight: 0.6, reactions: ['Трактор заехал во двор.'] },
  { id: 'pot', kind: 'weird', label: 'кастрюля', emoji: '🥘', score: 0, lifespanMs: 3500, weight: 0.6, reactions: ['Неизвестная кастрюля.'] },
  { id: 'bag', kind: 'weird', label: 'пакет', emoji: '🛍️', score: 0, lifespanMs: 3500, weight: 0.6, reactions: ['Пакет неизвестного назначения.'] },
  { id: 'another-plate', kind: 'weird', label: 'ещё одна тарелка', emoji: '🍽️', score: 0, lifespanMs: 3500, weight: 0.7, eventWeights: { mamaMode: 3 }, reactions: ['Ещё одна тарелка.'] },
  { id: 'grandpa', kind: 'weird', label: 'дедушка', emoji: '👴', score: 0, lifespanMs: 3500, weight: 0.5, reactions: ['Случайный дедушка.'] },
  { id: 'grape', kind: 'weird', label: 'виноград', emoji: '🍇', score: 0, lifespanMs: 3500, weight: 0.6, eventWeights: { mamaMode: 2 }, reactions: ['Виноград.'] },
  { id: 'wifi', kind: 'weird', label: 'Wi-Fi', emoji: '📶', score: 0, lifespanMs: 3500, weight: 0.5, reactions: ['Wi-Fi появился.'] },
  // ---- актёры специальных событий ----
  { id: 'lateStudent', kind: 'good', label: 'опоздавший ученик', emoji: '🏃', score: 40, lifespanMs: 2600, moving: true, reactions: ['Ученик доставлен на урок.', 'Опоздание зафиксировано и прощено.'] },
  { id: 'bossWord', kind: 'weird', label: 'հակահեղափոխականություն', emoji: '📜', score: 5, lifespanMs: 8000, hp: 8, reactions: ['СЛОВО СОПРОТИВЛЯЕТСЯ.', 'Оно растёт.'] },
];

/** Специальные события (геймдизайн §10). */
export const EVENTS: EventDef[] = [
  { id: 'mamaMode', title: 'ՄԱՄԱ MODE — ВСЕ ЕДЯТ', startWindowMs: [16000, 62000], durationMs: 6000, weight: 10 },
  { id: 'russianInvasion', title: '⚠️ ՌՈՒՍԵՐԵՆԻ ՆԵՐԽՈՒԺՈՒՄ', startWindowMs: [18000, 64000], durationMs: 5500, weight: 9 },
  { id: 'grammarQuestion', title: 'УЧЕНИК ЗАДАЛ ВОПРОС ПО ГРАММАТИКЕ', startWindowMs: [25000, 60000], durationMs: 4000, weight: 8 },
  { id: 'sheepChaos', title: '⚠️ ОВЦЫ ВНЕ КОНТРОЛЯ', startWindowMs: [20000, 65000], durationMs: 5000, weight: 8 },
  { id: 'lateStudent', title: 'УРОК НАЧАЛСЯ 12 МИНУТ НАЗАД', startWindowMs: [22000, 66000], durationMs: 3000, weight: 7 },
  { id: 'homeworkCheck', title: 'ПОКАЖИТЕ ДОМАШНЕЕ ЗАДАНИЕ', startWindowMs: [24000, 62000], durationMs: 6000, weight: 7 },
  { id: 'armenianBoss', title: '⚠️ ОБНАРУЖЕНО ДЛИННОЕ АРМЯНСКОЕ СЛОВО', startWindowMs: [30000, 68000], durationMs: 8000, weight: 4 },
];

/** Исходы тапов по странным объектам (овца и компания). */
export const WEIRD_OUTCOMES: WeirdOutcome[] = [
  { text: 'ОВЦА СПАСЕНА +30', score: 30, village: 4, patience: 2, tone: 'positive', weight: 3, countsAsSheepSaved: true },
  { text: 'ОВЦА УКРАЛА ԲԱՌԱՊԱՇԱՐԸ −15', score: -15, village: 0, patience: -10, tone: 'negative', weight: 2, comboBreak: true },
  { text: 'ОВЦА ПОДАРИЛА КОМБО +2', score: 10, village: 0, patience: 0, tone: 'positive', weight: 2, comboBonus: 2 },
  { text: 'ЭТО БЫЛА НЕ ОВЦА', score: 0, village: -5, patience: 0, tone: 'weird', weight: 1.5, comboBreak: true },
  { text: 'Овца игнорирует образовательный процесс.', score: 0, village: 0, patience: 0, tone: 'weird', weight: 2 },
  { text: 'ОВЦА ПРИНЕСЛА ԳԱԹԱ +20', score: 20, village: 2, patience: 0, tone: 'positive', weight: 2 },
  { text: 'Овца впечатлена.', score: 5, village: 0, patience: 5, tone: 'positive', weight: 1.5 },
  { text: 'Кот ушёл с урока. Его никто не держал.', score: 0, village: 0, patience: 0, tone: 'weird', weight: 1.2 },
  { text: 'Сосед просто смотрел.', score: 0, village: 0, patience: 0, tone: 'weird', weight: 1.2 },
  { text: 'Трактор каким-то образом оказался на крыше. +10', score: 10, village: 0, patience: 0, tone: 'positive', weight: 1 },
  { text: 'В кастрюле была гата. +15', score: 15, village: 0, patience: 0, tone: 'positive', weight: 1.2 },
  { text: 'Пакет был ничей. Теперь твой. +5', score: 5, village: 0, patience: 0, tone: 'weird', weight: 1.2 },
  { text: 'Ещё одна тарелка. Конечно. +10', score: 10, village: 0, patience: 0, tone: 'positive', weight: 1.2 },
  { text: 'Дедушка одобрил. +10', score: 10, village: 0, patience: 5, tone: 'positive', weight: 1 },
  { text: 'Виноград. Обычный виноград. +5', score: 5, village: 0, patience: 0, tone: 'weird', weight: 1 },
  { text: 'Wi-Fi работает. Чудо. +15', score: 15, village: 0, patience: 0, tone: 'positive', weight: 0.8 },
];

/** Комбо-титулы (геймдизайн §9). */
export const COMBO_LINES: { level: number; text: string }[] = [
  { level: 3, text: 'ԼԱՎ Է' },
  { level: 5, text: 'ՇԱՏ ԼԱՎ' },
  { level: 8, text: 'ԳԵՐԱԶԱՆՑ' },
  { level: 10, text: 'ԴՈՒ ՀԱՅ ԵՍ' },
  { level: 15, text: 'ԱԼԻՍԱՆ ՀՊԱՐՏ Է' },
  { level: 20, text: 'ՍԱ ԱՐԴԵՆ ՎՏԱՆԳԱՎՈՐ Է' },
];

/** Текст для старшего достигнутого уровня комбо (null, если комбо < 3). */
export function comboLine(combo: number): string | null {
  let best: string | null = null;
  for (const line of COMBO_LINES) {
    if (combo >= line.level) best = line.text;
  }
  return best;
}

/** Системные шутки между событиями (геймдизайн §31). */
export const SYSTEM_LINES: string[] = [
  'КОФЕ СТАБИЛИЗИРОВАЛ СИТУАЦИЮ',
  'СИТУАЦИЯ ПОД КОНТРОЛЕМ',
  'СИТУАЦИЯ НЕ ПОД КОНТРОЛЕМ',
  'НИКТО НЕ ЗНАЕТ, ЧТО ПРОИСХОДИТ',
  'ОБНАРУЖЕНА ԳԱԹԱ',
  'МАМА НЕСЁТ ЕЩЁ ЕДУ',
  'ГРАММАТИЧЕСКАЯ ОБСТАНОВКА УХУДШАЕТСЯ',
  'ПРЕПОДАВАТЕЛЬНИЦА ТЕРЯЕТ ТЕРПЕНИЕ',
  'ДЕРЕВНЯ ПЕРЕХОДИТ В РЕЖИМ ОБОРОНЫ',
  'ДОМАШНЕЕ ЗАДАНИЕ НЕ ОБНАРУЖЕНО',
];

/** Реакции на пропущенный вредный объект. */
export const MISS_REACTIONS: string[] = [
  'Это слово вы проходили вчера.',
  'Учительница всё видела.',
  'Русский язык обнаружен.',
  'Грамматика получила повреждения.',
  'Очень уверенно. Очень неправильно.',
];

/** Объявления при переходе в фазу хаоса. */
export const PHASE_CHAOS_LINES: string[] = [
  '⚠️ ПЕДАГОГИЧЕСКАЯ КАТАСТРОФА',
  '⚠️ ГРАММАТИЧЕСКИЙ ШТОРМ',
  '⚠️ ОБНАРУЖЕН РУССКИЙ ЯЗЫК',
  '⚠️ КТО-ТО НЕ СДЕЛАЛ ДОМАШКУ',
];

/** Реплики после победы над армянским боссом. */
export const BOSS_WIN_LINES: string[] = [
  'Никто не знает, что оно означает, но звучало уверенно.',
  'Слово произнесено и больше никогда не повторится.',
];
