import type { PreparedAction, PreviewCandidate } from './actions';
import type { AppError } from './errors';
import type { AbortSignalLike, Result } from './result';

/**
 * Hazırlanmış işlemi alıp aynı işleme ait düz metin sonucu döndüren sınır.
 *
 * Gerçek bağlantı, metni arka plan/yerel AI modülüne gönderir. Test derlemesi
 * aynı sınırda örnek sonuç kullanır. Sağlayıcı ayrıntıları iş mantığına sızmaz.
 */
export interface TextProcessor {
  readonly kind: 'development-sample' | 'connected';
  process(action: PreparedAction, signal: AbortSignalLike): Promise<Result<PreviewCandidate, AppError>>;
}
