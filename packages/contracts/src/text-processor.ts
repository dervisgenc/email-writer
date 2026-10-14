import type { PreparedAction, PreviewCandidate } from './actions';
import type { AppError } from './errors';
import type { AbortSignalLike, Result } from './result';

/**
 * Hazırlanmış işlemi alıp aynı işleme ait düz metin sonucu döndüren sınır.
 *
 * Bu aşamada yalnızca geliştirme derlemesindeki örnek sonuç kaynağı bu
 * arayüzü uygular. AI bağlantıları sonraki aşamada aynı sınırdan bağlanacak;
 * ortak iş mantığı ve arayüz bu değişiklikten etkilenmeyecek.
 */
export interface TextProcessor {
  readonly kind: 'development-sample' | 'connected';
  process(action: PreparedAction, signal: AbortSignalLike): Promise<Result<PreviewCandidate, AppError>>;
}
