/**
 * @fileoverview Deterministic Copilot operation router (main process).
 *
 * Chooses which EncodeX operation a goal maps to and turns it into ready-to-run
 * {@link CopilotAction}s. This is the offline, deterministic half of the Copilot
 * planner: it runs when no AI provider is configured, and it is also the
 * fallback whenever a configured provider fails or returns an unusable reply.
 *
 * It reuses the exact builders the MCP tools use (`src/mcp/operations.ts`), so a
 * Copilot job, an MCP call and a CLI command produce identical streams, naming
 * and options. It lives in `src/main` (not `src/shared/ai`) because those
 * builders reach into Node/main helpers and must never enter the renderer.
 */

import type { CopilotAction, CopilotOperation, CopilotResult } from '../../shared/copilot';
import type { AgentSkip } from '../../shared/ai/agent';
import type { RoutedOperation } from '../../shared/ai/llm';
import { analyzeMedia } from '../../shared/ai/analyze';
import { formatError } from '../../shared/errors';
import {
  buildCompressPlan,
  buildExtractAudioPlan,
  buildCutPlan,
  buildRemuxPlan,
  buildDemuxPlan,
  buildDemuxJobOptions,
} from '../../mcp/operations';
import type { BuiltOperation, OperationDetection, ProbedEntry } from './types';

export type { BuiltOperation, ProbedEntry };

/** Audio extension/name to the encoder the extract builder should use. */
const AUDIO_CODEC_BY_NAME: Record<string, string> = {
  mp3: 'libmp3lame',
  aac: 'aac',
  m4a: 'aac',
  flac: 'flac',
  wav: 'pcm_s16le',
  opus: 'libopus',
  ogg: 'libvorbis',
  vorbis: 'libvorbis',
};

/** Image extension/name to a normalized output format. */
const IMAGE_FORMAT_BY_NAME: Record<string, string> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  bmp: 'bmp',
  gif: 'gif',
  tiff: 'tiff',
  tif: 'tiff',
};

/** Containers the remux router recognises in a goal. */
const CONTAINERS = ['mp4', 'm4v', 'mkv', 'mov', 'webm', 'avi', 'ts'];

/** Operation priority shared by the English rules and the localized rules. */
const OPERATION_PRIORITY: CopilotOperation[] = [
  'remux',
  'demux',
  'extract_audio',
  'compress_image',
  'cut',
  'transcribe',
  'summarize',
  'chapters',
  'search_transcript',
  'translate',
  'find_similar',
  'analyze',
  'convert',
];

/**
 * Native-language operation words for the offline router. Substring matching
 * is deliberate: it also covers scripts without word boundaries (CJK, Arabic,
 * Hebrew, Hindi) where the English `\b` rules cannot match at all.
 */
const LOCALIZED_KEYWORDS: Record<string, Partial<Record<CopilotOperation, string[]>>> = {
  es: {
    remux: ['remux', 'reempaquetar', 'sin recodificar'],
    demux: ['demux', 'separar flujos', 'extraer flujos'],
    extract_audio: ['extraer audio', 'sacar audio', 'solo audio'],
    compress_image: ['comprimir imagen', 'reducir imagen', 'comprimir foto'],
    cut: ['cortar', 'recortar'],
    transcribe: ['transcribir', 'transcripción', 'voz a texto'],
    summarize: ['resumir', 'resumen'],
    chapters: ['capítulos'],
    search_transcript: ['buscar en la transcripción', 'buscar frase'],
    translate: ['traducir', 'traducción'],
    find_similar: ['duplicados', 'similares'],
    analyze: ['analizar', 'inspeccionar'],
  },
  fr: {
    remux: ['remux', 'réempaquetage', 'sans réencodage', 'copie de flux'],
    demux: ['demux', 'séparer les flux'],
    extract_audio: ['extraire le son', 'extraire audio', 'audio seulement'],
    compress_image: ['compresser image', 'réduire image', 'compresser photo'],
    cut: ['couper', 'rogner'],
    transcribe: ['transcrire', 'transcription', 'voix en texte'],
    summarize: ['résumer', 'résumé'],
    chapters: ['chapitres'],
    search_transcript: ['chercher dans la transcription', 'rechercher une phrase'],
    translate: ['traduire', 'traduction'],
    find_similar: ['doublons', 'similaires'],
    analyze: ['analyser', 'inspecter'],
  },
  de: {
    remux: ['remux', 'neu verpacken', 'ohne neu zu kodieren'],
    demux: ['demux', 'ströme trennen', 'streams trennen'],
    extract_audio: ['audio extrahieren', 'ton extrahieren', 'nur audio'],
    compress_image: ['bild komprimieren', 'foto komprimieren', 'bild verkleinern'],
    cut: ['schneiden', 'kürzen'],
    transcribe: ['transkribieren', 'transkription', 'sprache zu text'],
    summarize: ['zusammenfassen', 'zusammenfassung'],
    chapters: ['kapitel'],
    search_transcript: ['im transkript suchen', 'phrase suchen'],
    translate: ['übersetzen', 'übersetzung'],
    find_similar: ['duplikate', 'ähnliche'],
    analyze: ['analysieren', 'untersuchen'],
  },
  it: {
    remux: ['remux', 'riimpacchettare', 'senza ricodifica'],
    demux: ['demux', 'separare i flussi'],
    extract_audio: ['estrarre audio', 'solo audio', 'estrarre la musica'],
    compress_image: ['comprimere immagine', 'ridurre immagine', 'comprimere foto'],
    cut: ['tagliare', 'ritagliare'],
    transcribe: ['trascrivere', 'trascrizione', 'voce in testo'],
    summarize: ['riassumere', 'riassunto'],
    chapters: ['capitoli'],
    search_transcript: ['cercare nella trascrizione', 'cercare frase'],
    translate: ['tradurre', 'traduzione'],
    find_similar: ['duplicati', 'simili'],
    analyze: ['analizzare', 'ispezionare'],
  },
  pt: {
    remux: ['remux', 'reempacotar', 'sem recodificar'],
    demux: ['demux', 'separar fluxos', 'extrair fluxos'],
    extract_audio: ['extrair áudio', 'somente áudio', 'extrair música'],
    compress_image: ['comprimir imagem', 'reduzir imagem', 'comprimir foto'],
    cut: ['cortar', 'aparar'],
    transcribe: ['transcrever', 'transcrição', 'voz para texto'],
    summarize: ['resumir', 'resumo'],
    chapters: ['capítulos'],
    search_transcript: ['buscar na transcrição', 'buscar frase'],
    translate: ['traduzir', 'tradução'],
    find_similar: ['duplicados', 'similares'],
    analyze: ['analisar', 'inspecionar'],
  },
  nl: {
    remux: ['remux', 'herpakken', 'zonder opnieuw te encoderen'],
    demux: ['demux', 'stromen splitsen'],
    extract_audio: ['audio extraheren', 'alleen audio', 'geluid extraheren'],
    compress_image: ['afbeelding comprimeren', 'afbeelding verkleinen', 'foto comprimeren'],
    cut: ['knippen', 'bijsnijden'],
    transcribe: ['transcriberen', 'transcriptie', 'spraak naar tekst'],
    summarize: ['samenvatten', 'samenvatting'],
    chapters: ['hoofdstukken'],
    search_transcript: ['zoeken in transcriptie', 'zin zoeken'],
    translate: ['vertalen', 'vertaling'],
    find_similar: ['duplicaten', 'vergelijkbare'],
    analyze: ['analyseren', 'inspecteren'],
  },
  ru: {
    remux: ['ремукс', 'переупаковать', 'без перекодирования'],
    demux: ['разделение потоков', 'разделить потоки'],
    extract_audio: ['извлечь аудио', 'только аудио', 'извлечь звук'],
    compress_image: ['сжать изображение', 'уменьшить изображение', 'сжать фото'],
    cut: ['обрезать', 'вырезать'],
    transcribe: ['транскрибировать', 'транскрипция', 'речь в текст'],
    summarize: ['резюме', 'краткий пересказ'],
    chapters: ['главы'],
    search_transcript: ['найти в транскрипции', 'найти фразу'],
    translate: ['перевести', 'перевод'],
    find_similar: ['дубликаты', 'похожие'],
    analyze: ['проанализировать', 'анализ'],
  },
  uk: {
    remux: ['ремукс', 'перепакувати', 'без перекодування'],
    demux: ['розділити потоки'],
    extract_audio: ['витягнути аудіо', 'тільки аудіо', 'витягнути звук'],
    compress_image: ['стиснути зображення', 'зменшити зображення'],
    cut: ['обрізати', 'вирізати'],
    transcribe: ['транскрибувати', 'транскрипція'],
    summarize: ['короткий виклад', 'стисло'],
    chapters: ['розділи'],
    search_transcript: ['знайти в транскрипції'],
    translate: ['перекласти', 'переклад'],
    find_similar: ['дублікати', 'схожі'],
    analyze: ['проаналізувати', 'аналіз'],
  },
  pl: {
    remux: ['remux', 'przepakować', 'bez rekodowania'],
    demux: ['demux', 'rozdzielić strumienie'],
    extract_audio: ['wyodrębnić audio', 'tylko audio', 'wyciągnąć dźwięk'],
    compress_image: ['skompresować obraz', 'zmniejszyć obraz', 'skompresować zdjęcie'],
    cut: ['przyciąć', 'wyciąć'],
    transcribe: ['transkrybować', 'transkrypcja'],
    summarize: ['podsumować', 'podsumowanie'],
    chapters: ['rozdziały'],
    search_transcript: ['szukaj w transkrypcji', 'znaleźć frazę'],
    translate: ['przetłumaczyć', 'tłumaczenie'],
    find_similar: ['duplikaty', 'podobne'],
    analyze: ['przeanalizować', 'analiza'],
  },
  sv: {
    remux: ['remux', 'packa om', 'utan omkodning'],
    demux: ['dela upp strömmar'],
    extract_audio: ['extrahera ljud', 'endast ljud'],
    compress_image: ['komprimera bild', 'minska bild', 'komprimera foto'],
    cut: ['klippa', 'beskära'],
    transcribe: ['transkribera', 'transkription'],
    summarize: ['sammanfatta', 'sammanfattning'],
    chapters: ['kapitel'],
    search_transcript: ['sök i transkriptionen'],
    translate: ['översätta', 'översättning'],
    find_similar: ['duplikat', 'liknande'],
    analyze: ['analysera', 'granska'],
  },
  da: {
    remux: ['remux', 'pak om', 'uden omkodning'],
    demux: ['adskil streams'],
    extract_audio: ['udtræk lyd', 'kun lyd'],
    compress_image: ['komprimer billede', 'formindske billede'],
    cut: ['klippe', 'beskære'],
    transcribe: ['transskribere', 'tale til tekst'],
    summarize: ['resumere', 'resumé'],
    chapters: ['kapitler'],
    search_transcript: ['søg i transskription'],
    translate: ['oversætte', 'oversættelse'],
    find_similar: ['dubletter', 'lignende'],
    analyze: ['analysere', 'undersøge'],
  },
  fi: {
    remux: ['pakkaa uudelleen', 'ei uudelleenkoodausta'],
    demux: ['erota streamit'],
    extract_audio: ['poimi ääni', 'vain ääni'],
    compress_image: ['pakkaa kuva', 'pienennä kuva'],
    cut: ['leikkaa', 'rajaa'],
    transcribe: ['transkriboi', 'äänestä tekstiin'],
    summarize: ['tiivistää', 'yhteenveto'],
    chapters: ['luvut'],
    search_transcript: ['etsi transkriptiosta'],
    translate: ['käännä', 'käännös'],
    find_similar: ['duplikaatit', 'samankaltaiset'],
    analyze: ['analysoi', 'tarkasta'],
  },
  nb: {
    remux: ['remux', 'pakke om', 'uten omkoding'],
    demux: ['skille strømmer'],
    extract_audio: ['ekstrahere lyd', 'kun lyd'],
    compress_image: ['komprimere bilde', 'forminske bilde'],
    cut: ['klippe', 'beskjære'],
    transcribe: ['transkribere', 'tale til tekst'],
    summarize: ['oppsummere', 'sammendrag'],
    chapters: ['kapitler'],
    search_transcript: ['søk i transkripsjon'],
    translate: ['oversette', 'oversettelse'],
    find_similar: ['duplikater', 'lignende'],
    analyze: ['analysere', 'undersøke'],
  },
  tr: {
    remux: ['remux', 'yeniden paketle', 'yeniden kodlamadan'],
    demux: ['demux', 'akışları ayır'],
    extract_audio: ['sesi çıkar', 'sadece ses', 'müziği çıkar'],
    compress_image: ['görseli sıkıştır', 'fotoğrafı sıkıştır', 'görseli küçült'],
    cut: ['kesmek', 'kırpmak'],
    transcribe: ['transkript et', 'transkripsiyon', 'sesi yazıya çevir'],
    summarize: ['özetle', 'özet'],
    chapters: ['bölümler'],
    search_transcript: ['transkriptte ara', 'ifade ara'],
    translate: ['çeviri', 'tercüme'],
    find_similar: ['kopyalar', 'benzer'],
    analyze: ['analiz et', 'incele'],
  },
  ar: {
    remux: ['إعادة تغليف', 'بدون إعادة ترميز'],
    demux: ['فصل التدفقات'],
    extract_audio: ['استخراج الصوت', 'الصوت فقط'],
    compress_image: ['ضغط الصورة', 'تصغير الصورة'],
    cut: ['اقتطاع', 'قص المقطع'],
    transcribe: ['نسخ نصي', 'تحويل الصوت إلى نص'],
    summarize: ['تلخيص', 'ملخص'],
    chapters: ['فصول'],
    search_transcript: ['البحث في النص', 'ابحث عن عبارة'],
    translate: ['ترجمة', 'ترجم'],
    find_similar: ['نسخ مكررة', 'متشابهة'],
    analyze: ['تحليل', 'فحص'],
  },
  he: {
    remux: ['אריזה מחדש', 'ללא קידוד מחדש'],
    demux: ['הפרדת זרמים'],
    extract_audio: ['חילוץ אודיו', 'רק אודיו', 'חילוץ שמע'],
    compress_image: ['כיווץ תמונה', 'הקטנת תמונה'],
    cut: ['חתוך', 'גזור'],
    transcribe: ['תמלול', 'המרת דיבור לטקסט'],
    summarize: ['סיכום', 'לסכם'],
    chapters: ['פרקים'],
    search_transcript: ['חיפוש בתמלול'],
    translate: ['תרגום', 'לתרגם'],
    find_similar: ['כפילויות', 'דומים'],
    analyze: ['ניתוח', 'לנתח'],
  },
  hi: {
    remux: ['रीपैकेज', 'बिना दोबारा एन्कोडिंग'],
    demux: ['धाराओं को अलग करें'],
    extract_audio: ['ऑडियो निकालें', 'केवल ऑडियो'],
    compress_image: ['चित्र को संकुचित करें', 'छवि छोटी करें'],
    cut: ['काटें', 'ट्रिम करें'],
    transcribe: ['ट्रांसक्राइब', 'वाक् से पाठ'],
    summarize: ['सारांश', 'संक्षेप'],
    chapters: ['अध्याय'],
    search_transcript: ['ट्रांसक्रिप्ट में खोजें'],
    translate: ['अनुवाद'],
    find_similar: ['डुप्लिकेट', 'समान'],
    analyze: ['विश्लेषण', 'जांच'],
  },
  ja: {
    remux: ['再パッケージ', '再エンコードなし', 'リマックス'],
    demux: ['ストリームを分割', '分離して'],
    extract_audio: ['音声を抽出', '音声のみ'],
    compress_image: ['画像を圧縮', '画像を縮小', '写真を圧縮'],
    cut: ['カット', 'トリミング'],
    transcribe: ['文字起こし', '音声をテキストに'],
    summarize: ['要約', 'まとめ'],
    chapters: ['チャプター'],
    search_transcript: ['文字起こしから検索', 'フレーズを検索'],
    translate: ['翻訳', '字幕を翻訳'],
    find_similar: ['重複', '似ている'],
    analyze: ['分析', '解析'],
  },
  zh: {
    remux: ['重新封装', '不重新编码', '转封装'],
    demux: ['分离流', '拆分流'],
    extract_audio: ['提取音频', '仅音频'],
    compress_image: ['压缩图片', '缩小图片', '压缩照片'],
    cut: ['剪切', '裁剪'],
    transcribe: ['转录', '语音转文字', '生成字幕'],
    summarize: ['总结', '摘要'],
    chapters: ['章节'],
    search_transcript: ['搜索转录', '搜索字幕'],
    translate: ['翻译', '翻译字幕'],
    find_similar: ['重复文件', '相似文件'],
    analyze: ['分析', '检查'],
  },
  ko: {
    remux: ['재패키징', '재인코딩 없이', '리먹스'],
    demux: ['스트림 분리'],
    extract_audio: ['오디오 추출', '오디오만'],
    compress_image: ['이미지 압축', '이미지 축소', '사진 압축'],
    cut: ['자르기', '트리밍'],
    transcribe: ['전사', '음성을 텍스트로', '자막 생성'],
    summarize: ['요약'],
    chapters: ['챕터'],
    search_transcript: ['전사 검색', '문구 검색'],
    translate: ['번역', '자막 번역'],
    find_similar: ['중복', '유사한'],
    analyze: ['분석', '검사'],
  },
  vi: {
    remux: ['đóng gói lại', 'không mã hóa lại'],
    demux: ['tách luồng'],
    extract_audio: ['trích xuất âm thanh', 'chỉ âm thanh'],
    compress_image: ['nén hình ảnh', 'giảm kích thước ảnh'],
    cut: ['cắt', 'cắt bớt'],
    transcribe: ['phiên âm', 'chuyển giọng nói thành văn bản'],
    summarize: ['tóm tắt'],
    chapters: ['chương'],
    search_transcript: ['tìm trong bản ghi', 'tìm cụm từ'],
    translate: ['dịch', 'dịch phụ đề'],
    find_similar: ['trùng lặp', 'tương tự'],
    analyze: ['phân tích', 'kiểm tra'],
  },
  id: {
    remux: ['kemas ulang', 'tanpa pengkodean ulang'],
    demux: ['pisahkan aliran'],
    extract_audio: ['ekstrak audio', 'hanya audio'],
    compress_image: ['kompres gambar', 'perkecil gambar'],
    cut: ['potong', 'pangkas'],
    transcribe: ['transkrip', 'suara ke teks'],
    summarize: ['ringkas', 'ringkasan'],
    chapters: ['bab'],
    search_transcript: ['cari dalam transkrip'],
    translate: ['terjemahkan', 'terjemahan'],
    find_similar: ['duplikat', 'serupa'],
    analyze: ['analisis', 'periksa'],
  },
  th: {
    remux: ['แพ็กเกจใหม่', 'ไม่เข้ารหัสใหม่'],
    demux: ['แยกสตรีม'],
    extract_audio: ['สกัดเสียง', 'เฉพาะเสียง'],
    compress_image: ['บีบอัดภาพ', 'ย่อภาพ'],
    cut: ['ตัด', 'ตัดต่อ'],
    transcribe: ['ถอดเสียง', 'แปลงเสียงเป็นข้อความ'],
    summarize: ['สรุป'],
    chapters: ['บท'],
    search_transcript: ['ค้นหาในถอดเสียง'],
    translate: ['แปล', 'แปลซับไตเติล'],
    find_similar: ['ไฟล์ซ้ำ', 'คล้ายกัน'],
    analyze: ['วิเคราะห์', 'ตรวจสอบ'],
  },
};

/**
 * Native words for an explicit `convert` goal, kept separate because `convert`
 * is the router's default rather than a rule with its own English pattern.
 */
const LOCALIZED_CONVERT_KEYWORDS: Record<string, string[]> = {
  es: ['convertir'],
  fr: ['convertir'],
  de: ['konvertieren', 'umwandeln'],
  it: ['convertire'],
  pt: ['converter'],
  nl: ['converteren', 'omzetten'],
  ru: ['конвертировать', 'преобразовать'],
  uk: ['конвертувати', 'перетворити'],
  pl: ['konwertować'],
  sv: ['konvertera'],
  da: ['konvertere'],
  fi: ['muuntaa'],
  nb: ['konvertere'],
  tr: ['dönüştürmek'],
  ar: ['تحويل'],
  he: ['המר'],
  hi: ['बदलें', 'कन्वर्ट'],
  ja: ['変換'],
  zh: ['转换'],
  ko: ['변환'],
  vi: ['chuyển đổi'],
  id: ['konversi'],
  th: ['แปลง'],
};

/** All localized keyword tables, including the explicit-convert table. */
const LOCALIZED_KEYWORD_TABLES: Array<Partial<Record<CopilotOperation, string[]>>> = [
  ...Object.values(LOCALIZED_KEYWORDS),
  ...Object.values(LOCALIZED_CONVERT_KEYWORDS).map((terms) => ({ convert: terms })),
];

/**
 * Chooses the operation named by a goal: English keyword rules first, then the
 * native-language tables, and `convert` when nothing matches.
 * @param {string} goal - The natural-language goal.
 * @returns {OperationDetection} The operation and whether a keyword matched.
 */
function detectOperationFromGoal(goal: string): OperationDetection {
  const text = ` ${String(goal ?? '').toLowerCase()} `;
  if (/\b(remux|repackage|repack|container change|change (the )?container|no re-?encode|without re-?encoding|stream copy)\b/.test(text))
    return { operation: 'remux', matched: true };
  if (/\b(demux|extract (all )?streams?|separate streams?|split (in)?to streams?)\b/.test(text))
    return { operation: 'demux', matched: true };
  if (/\b(extract|rip|strip|pull).{0,24}(audio|sound|music|track)\b/.test(text) || /\b(audio only|mp3 only)\b/.test(text))
    return { operation: 'extract_audio', matched: true };
  if (
    /\b(compress|reduce|shrink|resize|convert).{0,24}(image|photo|picture|png|jpe?g|webp|tiff|bmp)\b/.test(text) ||
    /\b(image|photo)\b.*\b(compress|smaller|reduce)\b/.test(text)
  )
    return { operation: 'compress_image', matched: true };
  if (/\b(cut|trim|clip|slice|crop in time)\b/.test(text) || /\bfrom\b.+\bto\b/.test(text)) return { operation: 'cut', matched: true };
  // Media-intelligence rules run before the generic `analyze` rule so a goal
  // that names a specific intelligence task (summarize/transcribe/...) wins.
  if (
    /\b(transcribe|transcription|captions?|speech[- ]to[- ]text)\b/.test(text) ||
    /\bsubtitles?\b.{0,24}\b(speech|audio|speech-to-text)\b/.test(text)
  )
    return { operation: 'transcribe', matched: true };
  if (/\b(summar(?:y|ize|ise)|tl;?dr|recap|key ?points?|takeaways?)\b/.test(text)) return { operation: 'summarize', matched: true };
  if (/\b(chapters?|chapter markers?|table of contents)\b/.test(text)) return { operation: 'chapters', matched: true };
  if (/\b(find|search|locate)\b.{0,32}\b(says?|said|mentions?|talks? about|passage|quote|scene)\b/.test(text))
    return { operation: 'search_transcript', matched: true };
  if (/\btranslate\b/.test(text)) return { operation: 'translate', matched: true };
  if (/\b(duplicates?|dupes?|near[- ]?duplicates?|dedupe|redundant|similar)\b/.test(text))
    return { operation: 'find_similar', matched: true };
  if (/\b(analy[sz]e|inspect|examine|report|details|info|diagnose)\b/.test(text)) return { operation: 'analyze', matched: true };

  // The most specific phrase wins across languages (for example, "sök i
  // transkriptionen" is a transcript search, not plain transcription).
  let best: { operation: CopilotOperation; length: number } | undefined;
  for (const operation of OPERATION_PRIORITY) {
    for (const keywords of LOCALIZED_KEYWORD_TABLES) {
      for (const term of keywords[operation] ?? []) {
        if (text.includes(term) && (!best || term.length > best.length)) best = { operation, length: term.length };
      }
    }
  }
  if (best) return { operation: best.operation, matched: true };
  return { operation: 'convert', matched: false };
}

/**
 * Chooses the operation named by a goal, using ordered keyword rules. The first
 * match wins; `convert` is the default.
 * @param {string} goal - The natural-language goal.
 * @returns {CopilotOperation} The detected operation.
 */
export function detectOperation(goal: string): CopilotOperation {
  return detectOperationFromGoal(goal).operation;
}

/**
 * Detects the target container named in a goal (e.g. "remux to mkv").
 * @param {string} goal - The goal text.
 * @param {string} fallbackExt - Input extension used when none is named.
 * @returns {string} The target container extension (no dot).
 */
function detectContainer(goal: string, fallbackExt: string): string {
  const lower = String(goal ?? '').toLowerCase();
  const afterTo = /\bto\s+\.?(mp4|m4v|mkv|mov|webm|avi|ts)\b/.exec(lower);
  if (afterTo) return afterTo[1];
  for (const container of CONTAINERS) {
    if (new RegExp(`\\b${container}\\b`).test(lower)) return container;
  }
  return fallbackExt;
}

/** Common language names to BCP-47/ISO-639-1 codes for translate/transcribe. */
const LANGUAGE_BY_NAME: Record<string, string> = {
  english: 'en',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  dutch: 'nl',
  russian: 'ru',
  japanese: 'ja',
  korean: 'ko',
  chinese: 'zh',
  mandarin: 'zh',
  arabic: 'ar',
  hindi: 'hi',
  turkish: 'tr',
  polish: 'pl',
  swedish: 'sv',
  ukrainian: 'uk',
};

/**
 * Pulls a language code named after `to`/`into`/`in` in the goal.
 * @param {string} lower - Lower-cased goal text.
 * @returns {string | undefined} The language code, if named.
 */
function detectLanguage(lower: string): string | undefined {
  const named = /\b(?:to|into|in)\s+([a-z]{2}|[a-z][a-z-]+)\b/.exec(lower);
  if (!named) return undefined;
  const token = named[1];
  if (LANGUAGE_BY_NAME[token]) return LANGUAGE_BY_NAME[token];
  if (token.length === 2) return token;
  return undefined;
}

/**
 * Extracts operation-specific fields from a goal. Unknown fields are simply
 * absent; the builders apply their own defaults.
 * @param {CopilotOperation} operation - The operation to extract fields for.
 * @param {string} goal - The goal text.
 * @param {string} [inputExt] - The input's extension, for container defaults.
 * @returns {Record<string, unknown>} The extracted fields.
 */
export function extractFields(operation: CopilotOperation, goal: string, inputExt = 'mp4'): Record<string, unknown> {
  const lower = String(goal ?? '').toLowerCase();
  switch (operation) {
    case 'remux':
      return { container: detectContainer(goal, inputExt) };
    case 'demux': {
      const fields: Record<string, unknown> = {};
      if (/\bvideo\b/.test(lower) && !/\baudio\b/.test(lower)) fields.video = true;
      else if (/\baudio\b/.test(lower) && !/\bvideo\b/.test(lower)) fields.audio = true;
      else if (/\bsubtitle/.test(lower)) fields.subtitles = true;
      else fields.all = true;
      return fields;
    }
    case 'extract_audio': {
      const fields: Record<string, unknown> = {};
      for (const [name, codec] of Object.entries(AUDIO_CODEC_BY_NAME)) {
        if (new RegExp(`\\b${name}\\b`).test(lower)) {
          fields.audioCodec = codec;
          break;
        }
      }
      const bitrate = /\b(\d{2,3})\s?k(?:bps)?\b/.exec(lower);
      if (bitrate) fields.bitrate = `${bitrate[1]}k`;
      return fields;
    }
    case 'compress_image': {
      const fields: Record<string, unknown> = {};
      for (const [name, format] of Object.entries(IMAGE_FORMAT_BY_NAME)) {
        if (new RegExp(`\\b${name}\\b`).test(lower)) {
          fields.format = format;
          break;
        }
      }
      const quality = /\b(?:quality|q)\s*(?:=\s*)?(\d{1,2})\b/.exec(lower);
      if (quality) fields.quality = Number(quality[1]);
      return fields;
    }
    case 'cut': {
      const times = [...lower.matchAll(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g)].map((match) => match[1]);
      const fields: Record<string, unknown> = {};
      if (times[0]) fields.startTime = times[0];
      if (times[1]) fields.endTime = times[1];
      return fields;
    }
    case 'transcribe': {
      const fields: Record<string, unknown> = {};
      const language = detectLanguage(lower);
      if (language) fields.language = language;
      const format = /\b(srt|vtt|webvtt|ass)\b/.exec(lower);
      if (format) fields.format = format[1] === 'webvtt' ? 'vtt' : format[1];
      return fields;
    }
    case 'summarize': {
      const fields: Record<string, unknown> = {};
      if (/\b(short|brief|concise|quick)\b/.test(lower)) fields.maxSentences = 3;
      const topics = /\b(\d{1,2})\s+topics?\b/.exec(lower);
      if (topics) fields.maxTopics = Number(topics[1]);
      return fields;
    }
    case 'chapters': {
      const fields: Record<string, unknown> = {};
      const count = /\b(\d{1,2})\s+chapters?\b/.exec(lower);
      if (count) fields.maxChapters = Number(count[1]);
      return fields;
    }
    case 'search_transcript': {
      const fields: Record<string, unknown> = {};
      const quoted = /["'\u201c\u2018]([^"'\u201d\u2019]{1,120})["'\u201d\u2019]/.exec(goal);
      if (quoted) fields.query = quoted[1].trim();
      return fields;
    }
    case 'translate': {
      const fields: Record<string, unknown> = {};
      const language = detectLanguage(lower);
      if (language) fields.targetLanguage = language;
      const format = /\b(srt|vtt|webvtt|ass)\b/.exec(lower);
      if (format) fields.format = format[1] === 'webvtt' ? 'vtt' : format[1];
      return fields;
    }
    default:
      return {};
  }
}

/**
 * Routes an operation deterministically from a forced choice or the goal text.
 * @param {{ goal: string; operation: CopilotOperation | null; inputExt?: string }} request -
 *   The goal, a forced operation (or null), and the input extension.
 * @returns {RoutedOperation} The routed operation.
 */
export function routeOperationDeterministic(request: {
  goal: string;
  operation: CopilotOperation | null;
  inputExt?: string;
}): RoutedOperation {
  const detection = request.operation ? { operation: request.operation, matched: true } : detectOperationFromGoal(request.goal);
  return {
    operation: detection.operation,
    fields: extractFields(detection.operation, request.goal, request.inputExt ?? 'mp4'),
    rationale: [
      request.operation
        ? `Operation "${detection.operation}" was selected explicitly.`
        : `Routed to "${detection.operation}" from the goal text.`,
    ],
    confidence: detection.matched ? 0.5 : 0.3,
    providerId: 'rules',
    uncertain: !detection.matched,
  };
}

/**
 * Builds the actions or results for a non-convert operation over every entry.
 *
 * Each entry's own failures are isolated into a skip, mirroring the agent:
 * one unplannable file never fails the whole plan. `convert` is handled by the
 * agent planner in the Copilot IPC handler, not here.
 * @param {CopilotOperation} operation - The operation to build.
 * @param {Record<string, unknown>} fields - Fields extracted by the router.
 * @param {ProbedEntry[]} entries - The probed candidates.
 * @param {number} confidence - Planner confidence stamped on each action.
 * @param {string[]} rationale - Planner rationale stamped on each action.
 * @returns {BuiltOperation} The actions, results and skips.
 */
export function buildOperationActions(
  operation: CopilotOperation,
  fields: Record<string, unknown>,
  entries: ProbedEntry[],
  confidence: number,
  rationale: string[],
): BuiltOperation {
  const actions: CopilotAction[] = [];
  const results: CopilotResult[] = [];
  const skips: AgentSkip[] = [];

  for (const entry of entries) {
    const { file, facts, info } = entry;
    try {
      switch (operation) {
        case 'remux': {
          const plan = buildRemuxPlan(file, { container: fields.container as string | undefined }, info.streams);
          actions.push(makeAction('remux', actions.length, file, plan.output, plan.options, confidence, rationale));
          break;
        }
        case 'demux': {
          const plan = buildDemuxPlan(file, fields, info.streams);
          for (const target of plan.targets) {
            actions.push(makeAction('demux', actions.length, file, target.output, buildDemuxJobOptions(target), confidence, rationale));
          }
          break;
        }
        case 'extract_audio': {
          const plan = buildExtractAudioPlan(file, fields);
          actions.push(makeAction('extract_audio', actions.length, file, plan.output, plan.options, confidence, rationale));
          break;
        }
        case 'compress_image': {
          const plan = buildCompressPlan(file, fields);
          actions.push(makeAction('compress_image', actions.length, file, plan.output, plan.options, confidence, rationale));
          break;
        }
        case 'cut': {
          const plan = buildCutPlan(file, fields);
          actions.push(makeAction('cut', actions.length, file, plan.output, plan.options, confidence, rationale));
          break;
        }
        case 'analyze': {
          const analysis = analyzeMedia(info);
          results.push({ operation: 'analyze', input: file, title: analysis.summary, summary: analysis.summary, content: analysis });
          break;
        }
        default: {
          skips.push({ input: file, reason: `The "${operation}" operation is not available for this file.` });
          break;
        }
      }
    } catch (err) {
      skips.push({ input: file, reason: formatError(err).message });
    }
    void facts;
  }

  return { actions, results, skips };
}

/**
 * Assembles one {@link CopilotAction} with a stable, operation-prefixed id.
 * @param {CopilotOperation} operation - The action's operation.
 * @param {number} index - The action index (for the id).
 * @param {string} input - Source file path.
 * @param {string} output - Resolved output path.
 * @param {import('../../shared/types').ConversionOptions} options - Conversion options.
 * @param {number} confidence - Planner confidence.
 * @param {string[]} rationale - Planner rationale.
 * @returns {CopilotAction} The action.
 */
function makeAction(
  operation: CopilotOperation,
  index: number,
  input: string,
  output: string,
  options: import('../../shared/types').ConversionOptions,
  confidence: number,
  rationale: string[],
): CopilotAction {
  return {
    id: `${operation}_${index}`,
    operation,
    input,
    output,
    confidence,
    rationale,
    estimatedSavings: 0,
    options,
  };
}
