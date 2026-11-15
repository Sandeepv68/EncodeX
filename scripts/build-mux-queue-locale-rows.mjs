/**
 * @fileoverview Builds the mux queue translation rows for every locale table.
 *
 * The mux queue is the second queue in the app (next to the batch queue), so
 * its wording borrows the batch queue's vocabulary in each language: the
 * already-translated "queue", "output", "view" and "add" terms are reused
 * rather than invented again, and only the genuinely new words (the mux queue
 * name itself, the remux/demux kinds, and the "outputs" counter) are written
 * per language.
 *
 * Run with `node scripts/build-mux-queue-locale-rows.mjs` after changing this
 * file, then `node scripts/locale-backfill.mjs` to apply the rows.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'scripts/locale-data';
const LOCALES_DIR = 'src/renderer/i18n/locales';
const manifest = JSON.parse(readFileSync(join(DATA_DIR, 'manifest.json'), 'utf8'));

/**
 * Flattens a nested locale object into dotted keys.
 * @param {Record<string, unknown>} obj - Nested locale object.
 * @param {string} [prefix] - Current key path prefix.
 * @param {Record<string, string>} [out] - Flat map being built.
 * @returns {Record<string, string>} Flat map of dotted key to string value.
 */
function flat(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flat(v, key, out);
    else out[key] = v;
  }
  return out;
}

/**
 * The mux queue's own name, per language: the mux queue holds the remux and
 * demux jobs, so it needs its own word rather than the batch queue's name.
 * @type {Record<string, string>}
 */
const MUX_QUEUE_NAME = {
  af: 'Mux-waglys',
  ar: 'قائمة انتظار Mux',
  da: 'Mux-kø',
  de: 'Mux-Warteschlange',
  es: 'Cola Mux',
  fi: 'Mux-jono',
  fil: 'Pila ng Mux',
  fr: "File d'attente Mux",
  ga: 'Scuaine Mux',
  he: 'תור Mux',
  hi: 'मक्स क्यू',
  id: 'Antrean Mux',
  is: 'Mux-runubraut',
  it: 'Coda Mux',
  ja: 'Mux キュー',
  kl: 'Mux Ilerleq',
  km: 'ជួរដេក Mux',
  ko: 'Mux 큐',
  lo: 'ຄິວ Mux',
  mi: 'Rārangi Mux',
  mn: 'Mux дараалал',
  ms: 'Baris Giliran Mux',
  nb: 'Mux-kø',
  ne: 'मक्स कतार',
  nl: 'Mux-wachtrij',
  pl: 'Kolejka Mux',
  'pt-BR': 'Fila Mux',
  'pt-PT': 'Fila Mux',
  ru: 'Очередь Mux',
  si: 'Mux කණ්ඩායම',
  sv: 'Mux-kö',
  th: 'คิว Mux',
  tl: 'Pila ng Mux',
  uk: 'Черга Mux',
  vi: 'Hàng đợi Mux',
  'zh-Hans': 'Mux 队列',
  'zh-Hant': 'Mux 佇列',
};

/**
 * The general (batch) queue's tab name, per language.
 * @type {Record<string, string>}
 */
const GENERAL_TAB_NAME = {
  af: 'Groepwaglys',
  ar: 'قائمة الدفعات',
  da: 'Batchkø',
  de: 'Stapelwarteschlange',
  es: 'Cola de Lotes',
  fi: 'Eräjono',
  fil: 'Pila ng Batch',
  fr: "File d'Attente",
  ga: 'Scuaine Bhaisc',
  he: 'תור אצווה',
  hi: 'बैच क्यू',
  id: 'Antrean Batch',
  is: 'Runubraut',
  it: 'Coda batch',
  ja: 'バッチキュー',
  kl: 'Ilerleq',
  km: 'ជួរដេកដំណើរការដុំ',
  ko: '배치 큐',
  lo: 'ຄິວງານຫຼາຍອັນ',
  mi: 'Rārangi Tukinotanga',
  mn: 'Багц дараалал',
  ms: 'Baris Giliran Kelompok',
  nb: 'Batchkø',
  ne: 'ब्याच कतार',
  nl: 'Batchwachtrij',
  pl: 'Kolejka wsadowa',
  'pt-BR': 'Fila em Lote',
  'pt-PT': 'Fila em Lote',
  ru: 'Пакетная очередь',
  si: 'කණ්ඩායම් පෝලිම',
  sv: 'Batchkö',
  th: 'คิวงาน',
  tl: 'Pila ng Batch',
  uk: 'Пакетна черга',
  vi: 'Hàng đợi hàng loạt',
  'zh-Hans': '批量队列',
  'zh-Hant': '批次佇列',
};

/**
 * The "the mux queue is empty" sentence, per language.
 * @type {Record<string, string>}
 */
const EMPTY_TEXT = {
  af: 'Die Mux-waglys is leeg.',
  ar: 'قائمة انتظار Mux فارغة.',
  da: 'Mux-køen er tom.',
  de: 'Die Mux-Warteschlange ist leer.',
  es: 'La cola Mux está vacía.',
  fi: 'Mux-jono on tyhjä.',
  fil: 'Walang laman ang pile ng Mux.',
  fr: "La file d'attente Mux est vide.",
  ga: 'Tá an scuaine Mux folamh.',
  he: 'תור ה-Mux ריק.',
  hi: 'मक्स क्यू खाली है।',
  id: 'Antrean Mux kosong.',
  is: 'Mux-runubrautin er tóm.',
  it: 'La coda Mux è vuota.',
  ja: 'Mux キューは空です。',
  kl: 'Mux Ilerleqi tammaqartoq.',
  km: 'ជួរដេក Mux ទទេ។',
  ko: 'Mux 큐가 비어 있습니다.',
  lo: 'ຄິວ Mux ຫວ່າງ.',
  mi: 'Kua puta te rārangi Mux.',
  mn: 'Mux дараалал хоосон.',
  ms: 'Baris giliran Mux kosong.',
  nb: 'Mux-køen er tom.',
  ne: 'मक्स कतार खाली छ।',
  nl: 'De Mux-wachtrij is leeg.',
  pl: 'Kolejka Mux jest pusta.',
  'pt-BR': 'A fila Mux está vazia.',
  'pt-PT': 'A fila Mux está vazia.',
  ru: 'Очередь Mux пуста.',
  si: 'Mux කණ්ඩායම හිසිය.',
  sv: 'Mux-kön är tom.',
  th: 'คิว Mux ว่างเปล่า',
  tl: 'Walang laman ang pile ng Mux.',
  uk: 'Черга Mux порожня.',
  vi: 'Hàng đợi Mux trống.',
  'zh-Hans': 'Mux 队列为空。',
  'zh-Hant': 'Mux 佇列是空的。',
};

/**
 * The hint explaining where mux jobs come from, per language.
 * @type {Record<string, string>}
 */
const EMPTY_HINT = {
  af: 'Remux- en demux-take word vanaf hul eie bladsye by.',
  ar: 'تُضاف مهام إعادة التغليف وفك التدفقات من صفحاتها الخاصة.',
  da: 'Remux- og demux-opgaver tilføjes fra deres egne sider.',
  de: 'Remux- und Demux-Aufträge werden auf ihren eigenen Seiten hinzugefügt.',
  es: 'Los trabajos de remux y demux se añaden desde sus propias páginas.',
  fi: 'Remux- ja demux-tehtävät lisätään omilta sivuiltaan.',
  fil: 'Idinadagdag ang mga trabaho ng remux at demux mula sa kanilang mga pahina.',
  fr: 'Les tâches de remux et de demux sont ajoutées depuis leurs propres pages.',
  ga: 'Cuirtear ájobs remux agus demux ó pháistí a féin.',
  he: 'משימות Remux ו-Demux מתווספות מעמודיהן.',
  hi: 'रिमक्स और डीमक्स कार्य अपने पृष्ठों से जोड़े जाते हैं।',
  id: 'Tugas remux dan demux ditambahkan dari halaman masing-masing.',
  is: 'Remux- og demux-verkefni eru bætt við á eigin síðum sínum.',
  it: 'I processi di remux e demux vengono aggiunti dalle rispettive pagine.',
  ja: 'リマックスとデマックスのジョブは、それぞれのページから追加されます。',
  kl: 'Remux- aamma Demux-sulik suliassuutait nangneqsarpassunek naggumissut.',
  km: 'ការងារ Remux និង Demux ត្រូវបានបញ្ចូលពីទំព័ររបស់ពួកគេផ្ទាល់ៗ។',
  ko: '리멀텍스와 디멀텍스 작업은 각자의 페이지에서 추가합니다.',
  lo: 'ວຽກ Remux ແລະ Demux ຖືກເພີ່ມຈາກໜ້າຂອງຕົວຂອງ.',
  mi: 'Ka whakaputa ngā mahi remux, demux i ō rātou ao.',
  mn: 'Remux, Demux ажлуулууд өөрийн хуудсууднаас нэмэгдэнэ.',
  ms: 'Tugas remux dan demux ditambah dari halaman masing-masing.',
  nb: 'Remux- og demux-jobber legges til fra sidene sine.',
  ne: 'रिमक्स र डीमक्स कामहरू आफ्नै पृष्ठहरूबाट थपिन्छन्।',
  nl: 'Remux- en demuxtaken worden vanaf hun eigen pagina’s toegevoegd.',
  pl: 'Zadania remux i demux są dodawane z ich własnych stron.',
  'pt-BR': 'Trabalhos de remux e demux são adicionados nas próprias páginas.',
  'pt-PT': 'As tarefas de remux e demux são adicionadas nas respetivas páginas.',
  ru: 'Задания ремукса и демукса добавляются с их собственных страниц.',
  si: 'Remux සහ Demux කාර්ය එකිනෙකගේ පිටු වාරයන් එකතු වේ.',
  sv: 'Remux- och demuxjobb läggs till från sina egna sidor.',
  th: 'งาน remux และ demux จะเพิ่มจากหน้าของแต่ละงาน',
  tl: 'Idinadagdag ang mga trabaho ng remux at demux mula sa kanilang mga pahina.',
  uk: 'Завдання ремукса та демукса додаються зі своїх сторінок.',
  vi: 'Công việc remux và demux được thêm từ trang của chúng.',
  'zh-Hans': '封装和解复用任务从各自的页面添加。',
  'zh-Hant': '重新封裝和解封裝工作從各自的頁面新增。',
};

/**
 * The "{{count}} output(s)" counter label, per language.
 * @type {Record<string, string>}
 */
const TARGETS_COUNT = {
  af: '{{count}} uitset(te)',
  ar: '{{count}} مخرج',
  da: '{{count}} output',
  de: '{{count}} Ausgabe(n)',
  es: '{{count}} salida(s)',
  fi: '{{count}} tuloste(ta)',
  fil: '{{count}} output',
  fr: '{{count}} sortie(s)',
  ga: '{{count}} ascal amach',
  he: '{{count}} פלטים',
  hi: '{{count}} आउटपुट',
  id: '{{count}} keluaran',
  is: '{{count}} úttak',
  it: '{{count}} output',
  ja: '出力 {{count}} 件',
  kl: '{{count}} anineqassaaq',
  km: 'ទិន្នផល {{count}}',
  ko: '출력 {{count}}개',
  lo: 'ຜົນສົ່ງອອກ {{count}}',
  mi: '{{count}} putanga',
  mn: '{{count}} гаралт',
  ms: '{{count}} output',
  nb: '{{count}} utdata',
  ne: '{{count}} आउटपुट',
  nl: '{{count}} uitvoer',
  pl: '{{count}} wyjść',
  'pt-BR': '{{count}} saída(s)',
  'pt-PT': '{{count}} saída(s)',
  ru: 'Выходных файлов: {{count}}',
  si: 'ප්‍රතිදාන {{count}}',
  sv: '{{count}} utdata',
  th: 'เอาต์พุต {{count}} รายการ',
  tl: '{{count}} output',
  uk: 'Вихідних файлів: {{count}}',
  vi: '{{count}} đầu ra',
  'zh-Hans': '{{count}} 个输出',
  'zh-Hant': '{{count}} 個輸出',
};

/**
 * The "no outputs" empty label, per language.
 * @type {Record<string, string>}
 */
const NO_OUTPUTS = {
  af: 'Geen uitsette nie',
  ar: 'لا توجد مخرجات',
  da: 'Ingen output',
  de: 'Keine Ausgaben',
  es: 'Sin salidas',
  fi: 'Ei tuloksia',
  fil: 'Walang output',
  fr: 'Aucune sortie',
  ga: 'Níl ascal amach ar bith',
  he: 'אין פלטים',
  hi: 'कोई आउटपुट नहीं',
  id: 'Tidak ada keluaran',
  is: 'Engin úttak',
  it: 'Nessun output',
  ja: '出力なし',
  kl: 'Anineqassaaq aammaqartoq',
  km: 'គ្មានទិន្នផល',
  ko: '출력 없음',
  lo: 'ບໍ່ມີຜົນສົ່ງອອກ',
  mi: 'Kā puta',
  mn: 'Гаралт байхгүй',
  ms: 'Tiada output',
  nb: 'Ingen utdata',
  ne: 'कुनै आउटपुट छैन',
  nl: 'Geen uitvoer',
  pl: 'Brak wyjść',
  'pt-BR': 'Sem saídas',
  'pt-PT': 'Sem saídas',
  ru: 'Нет выходных файлов',
  si: 'ප්‍රතිදානයක් නැත',
  sv: 'Inga utdata',
  th: 'ไม่มีเอาต์พุต',
  tl: 'Walang output',
  uk: 'Немає вихідних файлів',
  vi: 'Không có đầu ra',
  'zh-Hans': '无输出',
  'zh-Hant': '無輸出',
};

/**
 * The "add to queue" button label, per language.
 * @type {Record<string, string>}
 */
const ADD_TO_QUEUE = {
  af: 'Voeg by die waglys',
  ar: 'إضافة إلى قائمة الانتظار',
  da: 'Tilføj til køen',
  de: 'Zur Warteschlange hinzufügen',
  es: 'Añadir a la cola',
  fi: 'Lisää jonoon',
  fil: 'Magdagdag sa queue',
  fr: "Ajouter à la file d'attente",
  ga: 'Cuir leis an scuaine',
  he: 'הוסף לתור',
  hi: 'क्यू में जोड़ें',
  id: 'Tambahkan ke antrean',
  is: 'Bæta við biðröð',
  it: 'Aggiungi alla coda',
  ja: 'キューに追加',
  kl: 'Ilerleqmut ilannguk',
  km: 'បន្ថែមទៅជួរដេក',
  ko: '큐에 추가',
  lo: 'ເພີ່ມໃສ່ຄິວ',
  mi: 'Tāpiri ki te rārangi',
  mn: 'Дарааллд нэмэх',
  ms: 'Tambah ke baris giliran',
  nb: 'Legg til i køen',
  ne: 'कतारमा थप्नुहोस्',
  nl: 'Aan wachtrij toevoegen',
  pl: 'Dodaj do kolejki',
  'pt-BR': 'Adicionar à fila',
  'pt-PT': 'Adicionar à fila',
  ru: 'Добавить в очередь',
  si: 'කණ්ඩායමට එකතු කරන්න',
  sv: 'Lägg till i kön',
  th: 'เพิ่มลงคิว',
  tl: 'Magdagdag sa queue',
  uk: 'Додати до черги',
  vi: 'Thêm vào hàng đợi',
  'zh-Hans': '加入队列',
  'zh-Hant': '加入佇列',
};

/**
 * The "view queue" link label, per language.
 * @type {Record<string, string>}
 */
const VIEW_QUEUE = {
  af: 'Bekyk waglys',
  ar: 'عرض قائمة الانتظار',
  da: 'Vis kø',
  de: 'Warteschlange ansehen',
  es: 'Ver la cola',
  fi: 'Näytä jono',
  fil: 'Tingnan ang queue',
  fr: "Voir la file d'attente",
  ga: 'Féach ar an scuaine',
  he: 'הצג תור',
  hi: 'क्यू देखें',
  id: 'Lihat antrean',
  is: 'Skoða runubraut',
  it: 'Visualizza la coda',
  ja: 'キューを表示',
  kl: 'Takussa Ilerleq',
  km: 'មើលជួរដេក',
  ko: '큐 보기',
  lo: 'ເບິ່ງຄິວ',
  mi: 'Tirohia te rārangi',
  mn: 'Дарааллыг харах',
  ms: 'Lihat baris giliran',
  nb: 'Vis kø',
  ne: 'कतार हेर्नुहोस्',
  nl: 'Wachtrij bekijken',
  pl: 'Zobacz kolejkę',
  'pt-BR': 'Ver fila',
  'pt-PT': 'Ver fila',
  ru: 'Показать очередь',
  si: 'කණ්ඩායම බලන්න',
  sv: 'Visa kön',
  th: 'ดูคิว',
  tl: 'Tingnan ang queue',
  uk: 'Переглянути чергу',
  vi: 'Xem hàng đợi',
  'zh-Hans': '查看队列',
  'zh-Hant': '檢視佇列',
};

/**
 * The "go to remux"/"go to demux" button labels, per language. Both are built
 * from the language's own "go to" phrasing and its own remux/demux names.
 * @type {Record<string, [string, string]>}
 */
const OPEN_PAGES = {
  af: ['Gaan na Remux', 'Gaan na Demux'],
  ar: ['الانتقال إلى إعادة التغليف', 'الانتقال إلى فك التدفقات'],
  da: ['Gå til Remux', 'Gå til Demux'],
  de: ['Zu Remux wechseln', 'Zu Demux wechseln'],
  es: ['Ir a Remux', 'Ir a Demux'],
  fi: ['Siirry Remuxiin', 'Siirry Demuxiin'],
  fil: ['Pumunta sa Remux', 'Pumunta sa Demux'],
  fr: ['Aller à Remux', 'Aller à Demux'],
  ga: ['Téigh go dtí Athchumhdach', 'Téigh go dtí Dácmhcseáil'],
  he: ['מעבר לאריזה מחדש', 'מעבר לפיצול זרמים'],
  hi: ['रिमक्स पर जाएँ', 'डीमक्स पर जाएँ'],
  id: ['Ke Remuks', 'Ke Demuks'],
  is: ['Fara í Remux', 'Fara í Demux'],
  it: ['Vai a Remux', 'Vai a Demux'],
  ja: ['Remux へ移動', 'Demux へ移動'],
  kl: ['Remux-mut nunngornerit', 'Demux-mut nunngornerit'],
  km: ['ទៅ Remux', 'ទៅ Demux'],
  ko: ['리멀텍스로 이동', '디멀텍스로 이동'],
  lo: ['ໄປ Remux', 'ໄປ Demux'],
  mi: ['Haere ki te Remux', 'Haere ki te Demux'],
  mn: ['Remux руу очих', 'Demux руу очих'],
  ms: ['Pergi ke Remux', 'Pergi ke Demux'],
  nb: ['Gå til Remux', 'Gå til Demux'],
  ne: ['रिमक्समा जानुहोस्', 'डीमक्समा जानुहोस्'],
  nl: ['Ga naar Remux', 'Ga naar Demux'],
  pl: ['Przejdź do Remux', 'Przejdź do Demux'],
  'pt-BR': ['Ir para Remux', 'Ir para Demux'],
  'pt-PT': ['Ir para Remux', 'Ir para Demux'],
  ru: ['Перейти к Ремукс', 'Перейти к Демукс'],
  si: ['Remux වෙත් යන්න', 'Demux වෙත් යන්න'],
  sv: ['Gå till Remux', 'Gå till Demux'],
  th: ['ไปที่ Remux', 'ไปที่ Demux'],
  tl: ['Pumunta sa Remux', 'Pumunta sa Demux'],
  uk: ['Перейти до Ремукс', 'Перейти до Демукс'],
  vi: ['Đến Đóng gói lại', 'Đến Tách luồng'],
  'zh-Hans': ['前往封装', '前往解复用'],
  'zh-Hant': ['前往重新封裝', '前往解封裝'],
};

/**
 * The "remux added"/"streams added" toast messages, per language.
 * @type {Record<string, [string, string]>}
 */
const QUEUED_TOASTS = {
  af: ['Remux by die Mux-waglys gevoeg', 'Strome by die Mux-waglys gevoeg'],
  ar: ['تمت إضافة إعادة التغليف إلى قائمة انتظار Mux', 'تمت إضافة التدفقات إلى قائمة انتظار Mux'],
  da: ['Remux føjet til Mux-køen', 'Streams føjet til Mux-køen'],
  de: ['Remux zur Mux-Warteschlange hinzugefügt', 'Streams zur Mux-Warteschlange hinzugefügt'],
  es: ['Remux añadido a la cola Mux', 'Flujos añadidos a la cola Mux'],
  fi: ['Remux lisätty Mux-jonoon', 'Virrat lisätty Mux-jonoon'],
  fil: ['Naidagdag ang Remux sa Pila ng Mux', 'Naidagdag ang mga stream sa Pila ng Mux'],
  fr: ["Remux ajouté à la file d'attente Mux", "Flux ajoutés à la file d'attente Mux"],
  ga: ['Cuireadh an t-athchumhdach leis an scuaine Mux', 'Cuireadh na sruthanna leis an scuaine Mux'],
  he: ['האריזה מחדש נוספה לתור ה-Mux', 'הזרמים נוספו לתור ה-Mux'],
  hi: ['रिमक्स मक्स क्यू में जोड़ा गया', 'स्ट्रीम्स मक्स क्यू में जोड़े गए'],
  id: ['Remuks ditambahkan ke Antrean Mux', 'Aliran ditambahkan ke Antrean Mux'],
  is: ['Remux bætt við Mux-runubrautina', 'Straumarnir voru dregnir úr og bætt við Mux-runubrautina'],
  it: ['Remux aggiunto alla coda Mux', 'Flussi aggiunti alla coda Mux'],
  ja: ['Remux を Mux キューに追加しました', 'ストリームを Mux キューに追加しました'],
  kl: ['Remux Mux Ilerleqmut ilanngunneqarpoq', 'Stream-it Mux Ilerleqmut ilanngunneqarput'],
  km: ['Remux ត្រូវបានបន្ថែមទៅជួរដេក Mux', 'ស្ទ្រីមត្រូវបានបន្ថែមទៅជួរដេក Mux'],
  ko: ['리멀텍스를 Mux 큐에 추가했습니다', '스트림을 Mux 큐에 추가했습니다'],
  lo: ['ເພີ່ມ Remux ໃສ່ຄິວ Mux ແລ້ວ', 'ເພີ່ມສະຕຣີມໃສ່ຄິວ Mux ແລ້ວ'],
  mi: ['Kua whakaputa te Remux ki te rārangi Mux', 'Kua whakaputa ngā te streaming ki te rārangi Mux'],
  mn: ['Remux Mux дараалд нэмэгдлээ', 'Стримүүдийг Mux дараалд нэмэгдлээ'],
  ms: ['Remux ditambah ke Baris Giliran Mux', 'Aliran ditambah ke Baris Giliran Mux'],
  nb: ['Remux lagt til i Mux-køen', 'Strømmene ble lagt til i Mux-køen'],
  ne: ['रिमक्स मक्स कतारमा थपियो', 'स्ट्रिमहरू मक्स कतारमा थपिए'],
  nl: ['Remux toegevoegd aan de Mux-wachtrij', 'Streams toegevoegd aan de Mux-wachtrij'],
  pl: ['Remux dodany do kolejki Mux', 'Strumienie dodane do kolejki Mux'],
  'pt-BR': ['Remux adicionado à Fila Mux', 'Fluxos adicionados à Fila Mux'],
  'pt-PT': ['Remux adicionado à Fila Mux', 'Fluxos adicionados à Fila Mux'],
  ru: ['Ремукс добавлен в очередь Mux', 'Потоки добавлены в очередь Mux'],
  si: ['Remux Mux කණ්ඩායමට එකතු කරන ලදී', 'ස්ට්‍රීම් Mux කණ්ඩායමට එකතු කරන ලදී'],
  sv: ['Remux lades till i Mux-kön', 'Strömmarna lades till i Mux-kön'],
  th: ['เพิ่ม Remux ไปยังคิว Mux แล้ว', 'เพิ่มสตรีมไปยังคิว Mux แล้ว'],
  tl: ['Naidagdag ang Remux sa Pila ng Mux', 'Naidagdag ang mga stream sa Pila ng Mux'],
  uk: ['Ремукс додано до черги Mux', 'Потоки додано до черги Mux'],
  vi: ['Đã thêm Đóng gói lại vào Hàng đợi Mux', 'Đã thêm các luồng vào Hàng đợi Mux'],
  'zh-Hans': ['封装已加入 Mux 队列', '各个流已加入 Mux 队列'],
  'zh-Hant': ['重新封裝已加入 Mux 佇列', '各個串流已加入 Mux 佇列'],
};

for (const [table, locales] of Object.entries(manifest.groups)) {
  const tablePath = join(DATA_DIR, `${table}.json`);
  const rows = JSON.parse(readFileSync(tablePath, 'utf8'));
  const locale = flat(JSON.parse(readFileSync(join(LOCALES_DIR, `${locales[0]}.json`), 'utf8')));

  rows['muxQueue.tabGeneral'] = GENERAL_TAB_NAME[table];
  rows['muxQueue.tabMux'] = MUX_QUEUE_NAME[table];
  rows['muxQueue.empty'] = EMPTY_TEXT[table];
  rows['muxQueue.emptyHint'] = EMPTY_HINT[table];
  rows['muxQueue.openRemux'] = OPEN_PAGES[table][0];
  rows['muxQueue.openDemux'] = OPEN_PAGES[table][1];
  rows['muxQueue.start'] = locale['batchQueue.start'];
  rows['muxQueue.pause'] = locale['batchQueue.pause'];
  rows['muxQueue.resume'] = locale['batchQueue.resume'];
  rows['muxQueue.cancelAll'] = locale['batchQueue.cancelAll'];
  rows['muxQueue.clearCompleted'] = locale['batchQueue.clearCompleted'];
  rows['muxQueue.concurrency'] = locale['batchQueue.concurrency'];
  rows['muxQueue.stats'] = locale['batchQueue.stats'];
  rows['muxQueue.kindRemux'] = locale['nav.remux'];
  rows['muxQueue.kindDemux'] = locale['nav.demux'];
  rows['muxQueue.targets'] = TARGETS_COUNT[table];
  rows['muxQueue.outputDir'] = locale['batchQueue.outputDir'];
  rows['muxQueue.noOutputs'] = NO_OUTPUTS[table];
  rows['muxQueue.detailsTargets'] = locale['batchQueue.detailsOutput'];
  rows['muxQueue.detailsCreatedAt'] = locale['batchQueue.detailsCreatedAt'];
  rows['muxQueue.viewQueue'] = VIEW_QUEUE[table];
  rows['muxQueue.addToQueue'] = ADD_TO_QUEUE[table];
  rows['muxQueue.dragHandle'] = locale['batchQueue.dragHandle'];
  rows['muxQueue.paused'] = locale['batchQueue.paused'];
  rows['muxQueue.filters.all'] = locale['batchQueue.filters.all'];
  rows['muxQueue.filters.queued'] = locale['batchQueue.filters.queued'];
  rows['muxQueue.filters.running'] = locale['batchQueue.filters.running'];
  rows['muxQueue.filters.done'] = locale['batchQueue.filters.done'];
  rows['muxQueue.filters.failed'] = locale['batchQueue.filters.failed'];
  rows['toast.remuxQueued'] = QUEUED_TOASTS[table][0];
  rows['toast.demuxQueued'] = QUEUED_TOASTS[table][1];

  writeFileSync(tablePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  console.log(`[mux-rows] ${table}: ${Object.keys(rows).length} keys`);
}
