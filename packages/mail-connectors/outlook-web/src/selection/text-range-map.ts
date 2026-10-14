import type { TextSegment } from '../reading/extract-text-blocks';

export interface DomPoint {
  readonly node: Node;
  readonly offset: number;
}

/** `b` noktası `a` noktasına göre önce (-1), aynı (0) veya sonra (1) mı? */
function comparePoints(document: Document, a: DomPoint, b: DomPoint): number {
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  return range.comparePoint(b.node, b.offset);
}

/**
 * Bir DOM noktasını çıkarılmış metindeki UTF-16 indisine çevirir. Nokta yapay
 * bir satır sonuna denk gelirse `forward` sonraki metnin başını, `backward`
 * önceki metnin sonunu seçer. Böylece seçim yapay karakterleri kapsamaz.
 */
export function offsetForPoint(
  document: Document,
  segments: readonly TextSegment[],
  point: DomPoint,
  bias: 'forward' | 'backward',
): number {
  let previousEnd = 0;
  for (const segment of segments) {
    if (point.node === segment.node) {
      const within = point.offset - segment.nodeOffset;
      const length = segment.end - segment.start;
      if (within >= 0 && within <= length) {
        return segment.start + within;
      }
      if (within < 0) {
        return bias === 'forward' ? segment.start : previousEnd;
      }
      previousEnd = segment.end;
      continue;
    }
    const segmentStart = { node: segment.node, offset: segment.nodeOffset };
    if (comparePoints(document, point, segmentStart) > 0) {
      // Bu metin parçası noktadan sonra başlıyor.
      return bias === 'forward' ? segment.start : previousEnd;
    }
    previousEnd = segment.end;
  }
  return previousEnd;
}

/**
 * Çıkarılmış metindeki aralığı gerçek bir DOM `Range` nesnesine çevirir.
 * Uçlar yapay karakterlere denk gelirse en yakın gerçek metne yaslanır.
 */
export function rangeForOffsets(
  document: Document,
  segments: readonly TextSegment[],
  start: number,
  end: number,
): Range | null {
  const startPoint = pointForOffset(segments, start, 'forward');
  const endPoint = pointForOffset(segments, end, 'backward');
  if (startPoint === null || endPoint === null) {
    return null;
  }
  const range = document.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  return range;
}

function pointForOffset(
  segments: readonly TextSegment[],
  offset: number,
  bias: 'forward' | 'backward',
): DomPoint | null {
  if (bias === 'forward') {
    for (const segment of segments) {
      if (offset < segment.end || (offset === segment.end && segment === segments[segments.length - 1])) {
        const within = Math.max(0, offset - segment.start);
        return { node: segment.node, offset: segment.nodeOffset + within };
      }
    }
  } else {
    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const segment = segments[index];
      if (segment !== undefined && offset > segment.start) {
        const within = Math.min(segment.end, offset) - segment.start;
        return { node: segment.node, offset: segment.nodeOffset + within };
      }
    }
    const first = segments[0];
    if (first !== undefined && offset === first.start) {
      return { node: first.node, offset: first.nodeOffset };
    }
  }
  return null;
}
