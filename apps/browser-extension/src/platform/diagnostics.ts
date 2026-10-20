import type { ErrorCode } from '@writehand/contracts';

/**
 * The extension's single logging point. Only an error code, an area name and numbers
 * that carry no personal content are accepted; email bodies, subjects, addresses, source
 * text, previews or full URLs can never be written here. Silent in regular builds.
 */
export interface DiagnosticEvent {
  readonly code: ErrorCode | 'UNHANDLED';
  readonly area: 'content-script' | 'background' | 'popup' | 'options' | 'connector';
  readonly numbers?: Readonly<Record<string, number>>;
}

export function reportDiagnostic(event: DiagnosticEvent): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- the single, content-free diagnostic output
    console.warn('[writehand]', event.area, event.code, event.numbers ?? {});
  }
}
