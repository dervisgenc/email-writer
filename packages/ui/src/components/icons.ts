/**
 * Fluent tarzı ince çizgili simgeler (20×20 ızgara). Simgeler süs amaçlıdır;
 * anlamı her zaman yanındaki metin veya düğmenin `aria-label`'ı taşır.
 */
export const ICON_PATHS = {
  sparkle: [
    'M9 3.2l1.4 3.6a2 2 0 0 0 1.1 1.1L15.1 9.3l-3.6 1.4a2 2 0 0 0-1.1 1.1L9 15.4l-1.4-3.6a2 2 0 0 0-1.1-1.1L2.9 9.3l3.6-1.4a2 2 0 0 0 1.1-1.1L9 3.2z',
    'M15.5 13.2l.6 1.5.6.3 1.5.6-1.5.6-.6.3-.6 1.5-.6-1.5-.3-.6-1.5-.6 1.5-.6.3-.3.6-1.5z',
  ],
  proofread: ['M3.5 5.5h10M3.5 9.5h10M3.5 13.5h5', 'M11.5 14.5l2 2 3.5-4'],
  translate: [
    'M3 5h7M6.5 3.5V5M4.5 5c.6 2.8 2.4 5 4.5 6M8.5 5c-.6 2.8-2.4 5-4.5 6',
    'M10.5 17l3-7.5 3 7.5M11.6 14.5h3.8',
  ],
  more: ['M5 10h.01M10 10h.01M15 10h.01'],
  close: ['M5.5 5.5l9 9M14.5 5.5l-9 9'],
  chevronDown: ['M6 8l4 4 4-4'],
  chevronRight: ['M8 6l4 4-4 4'],
  send: ['M3.5 9.6L16.5 4l-5.6 13-2.2-5.2-5.2-2.2z', 'M8.7 11.8l3.3-3.3'],
  copy: [
    'M7.5 6.5h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z',
    'M4.5 13.5v-9a1 1 0 0 1 1-1h7',
  ],
  undo: ['M7.5 5.5L4 9l3.5 3.5', 'M4 9h7.5a4 4 0 0 1 0 8H9'],
  edit: ['M12.6 4.4l3 3-8.1 8.1-3.8.8.8-3.8 8.1-8.1z', 'M11 6l3 3'],
  refresh: ['M15.5 10a5.5 5.5 0 1 1-1.7-4', 'M15.5 3.5V7H12'],
  openPanel: ['M4.5 4.5h11a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z', 'M12 4.5v11'],
  check: ['M5 10.5l3 3 7-7'],
  info: ['M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z', 'M10 9v4.5M10 6.5v.01'],
  warning: ['M10 3.2l7.3 13H2.7L10 3.2z', 'M10 8v4M10 14.2v.01'],
  mail: ['M3.5 5.5h13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z', 'M3 6.5l7 5 7-5'],
  plus: ['M10 4.5v11M4.5 10h11'],
} as const;

export type IconName = keyof typeof ICON_PATHS;
