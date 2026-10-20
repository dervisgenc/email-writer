import {
  appError,
  err,
  ok,
  REFINEMENT_INSTRUCTIONS,
  type Operation,
  type PreparedAction,
  type TextProcessor,
} from '@writehand/contracts';

/**
 * DEVELOPMENT AND TEST BUILDS ONLY. Stripped from the regular package at build
 * time; `scripts/verify-packages.mjs` checks that this marker is absent from the
 * production package.
 */
export const DEVELOPMENT_FIXTURE_MARKER = 'writehand-development-fixture';

/**
 * Fixed sample results. There are no rules pretending to improve the text and no
 * fake translation dictionary; predefined texts are returned to exercise the preview
 * and write-to-draft flow. The UI labels them "Sample result — development mode".
 */
const SAMPLE_TEXTS: Readonly<Record<Operation, string>> = {
  revise: 'Toplantıyı yarın yapabiliriz.',
  translate: 'We can hold the meeting tomorrow.',
  reply: 'Merhaba,\n\nMesajınız için teşekkürler. Yarın size uygun bir saatte görüşebiliriz.\n\nSaygılarımla',
  compose:
    'Merhaba,\n\nPerşembe 14:00 için kısa bir toplantı önermek istiyorum. Uygun olup olmadığınızı paylaşır mısınız?\n\nİyi çalışmalar',
};

/** "Change the result" samples, for exercising the formatted content flow (preview, write to draft). */
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
  /** Lets tests supply a specific text directly. */
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
