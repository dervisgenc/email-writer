/**
 * Bağlam kopyası için biçim normalizasyonu: satır sonlarını tek biçime getirir,
 * satır sonundaki boşlukları ve art arda gelen boş satırları temizler.
 * Harflere, sayılara, adreslere ve paragraf sırasına dokunmaz.
 *
 * Taslak seçim indislerine uygulanmaz; yalnızca bağlam kopyası içindir.
 */
export function normalizeContextText(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const result: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/[ \t\u00a0]+$/u, '');
    const previous = result[result.length - 1];
    if (line === '' && (previous === undefined || previous === '')) {
      continue;
    }
    result.push(line);
  }

  while (result[result.length - 1] === '') {
    result.pop();
  }

  return result.join('\n');
}

/**
 * Yalnızca eşitlik karşılaştırması için satır anahtarları üretir: Unicode
 * biçimini birleştirir, satır içi boşluk farklarını yok sayar ve boş satırları
 * atar. Sonuç metne uygulanmaz.
 */
export function toComparisonLines(text: string): string[] {
  return normalizeContextText(text.normalize('NFC'))
    .split('\n')
    .map((line) => line.replace(/\s+/gu, ' ').trim())
    .filter((line) => line.length > 0);
}
