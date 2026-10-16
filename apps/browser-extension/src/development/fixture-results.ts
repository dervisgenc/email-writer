import {
  appError,
  err,
  ok,
  REFINEMENT_INSTRUCTIONS,
  type Operation,
  type PreparedAction,
  type TextProcessor,
} from '@email-writer/contracts';

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

/** "Sonucu değiştir" örnekleri: biçimli içerik akışını (önizleme, taslağa yazma) denemek için. */
const REFINED_TEXTS = {
  table:
    'Merhaba,\n\nGüncel teklif aşağıdadır:\n\n| Kalem | Tutar |\n| --- | ---: |\n| Lisans | 40.000 TL |\n| Kurulum | 8.500 TL |\n\nSaygılarımla',
  list: 'Merhaba,\n\n- Toplantı perşembe 14:00\n- Gündem: bütçe ve takvim\n\nSaygılarımla',
  chart:
    'Merhaba,\n\nÇeyrek satışları:\n\n```chart\n{"title":"Satışlar","unit":"k€","data":[{"label":"Ç1","value":120},{"label":"Ç2","value":135}]}\n```\n\nSaygılarımla',
  other: 'Merhaba,\n\nKısaca: yarın görüşebiliriz.\n\nSaygılarımla',
} as const;

function sampleText(action: PreparedAction): string {
  const refinement = action.refinement?.instruction;
  if (refinement === undefined) return SAMPLE_TEXTS[action.operation];
  if (refinement === REFINEMENT_INSTRUCTIONS.table) return REFINED_TEXTS.table;
  if (refinement === REFINEMENT_INSTRUCTIONS.list) return REFINED_TEXTS.list;
  if (refinement === REFINEMENT_INSTRUCTIONS.chart) return REFINED_TEXTS.chart;
  return REFINED_TEXTS.other;
}

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
        text: options.text ?? sampleText(action),
        sample: true,
      });
    },
  };
}
