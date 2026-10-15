import { appError, err, ok, type Operation, type TextProcessor } from '@email-writer/contracts';

/**
 * YALNIZCA GELİŞTİRME VE TEST DERLEMESİ. Normal paketten derleme sırasında
 * çıkarılır; `scripts/verify-packages.mjs` bu işaretin üretim paketinde
 * bulunmadığını kontrol eder.
 */
export const DEVELOPMENT_FIXTURE_MARKER = 'email-writer-development-fixture';

/**
 * Sabit örnek sonuçlar. Metni iyileştirdiğini iddia eden kurallar veya sahte
 * bir çeviri sözlüğü yoktur; önizleme ve taslağa yazma akışını denemek için
 * önceden belirlenmiş metinler döner. Arayüz bunları "Örnek sonuç — geliştirme
 * modu" etiketiyle gösterir.
 */
const SAMPLE_TEXTS: Readonly<Record<Operation, string>> = {
  revise: 'Toplantıyı yarın yapabiliriz.',
  translate: 'We can hold the meeting tomorrow.',
  reply: 'Merhaba,\n\nMesajınız için teşekkürler. Yarın size uygun bir saatte görüşebiliriz.\n\nSaygılarımla',
  compose:
    'Merhaba,\n\nPerşembe 14:00 için kısa bir toplantı önermek istiyorum. Uygun olup olmadığınızı paylaşır mısınız?\n\nİyi çalışmalar',
};

export type FixtureScenario = 'success' | 'error';

export interface FixtureOptions {
  readonly scenario?: FixtureScenario;
  readonly delayMs?: number;
  /** Testlerin belirli bir metni doğrudan vermesi için. */
  readonly text?: string;
}

function wait(ms: number, signal: { readonly aborted: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    if (ms <= 0) {
      resolve(!signal.aborted);
      return;
    }
    setTimeout(() => resolve(!signal.aborted), ms);
  });
}

export function createFixtureProcessor(options: FixtureOptions = {}): TextProcessor {
  return {
    kind: 'development-sample',
    async process(action, signal) {
      const completed = await wait(options.delayMs ?? 400, signal);
      if (!completed) {
        return err(appError('READ_CANCELLED'));
      }
      if (options.scenario === 'error') {
        return err(appError('UNEXPECTED'));
      }
      return ok({
        requestId: action.requestId,
        sessionId: action.sessionId,
        formRevision: action.formRevision,
        text: options.text ?? SAMPLE_TEXTS[action.operation],
        sample: true,
      });
    },
  };
}
