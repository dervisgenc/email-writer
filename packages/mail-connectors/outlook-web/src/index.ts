export { createOutlookWebConnector } from './create-outlook-web-connector';
export type {
  OutlookWebConnection,
  OutlookWebOptions,
  SelectorReportEntry,
} from './create-outlook-web-connector';
export { OUTLOOK_PROVIDER_ID } from './identity/identity-registry';
export type { OutlookLauncherAnchor } from './mounting/locate-launcher-anchors';
export { OUTLOOK_SELECTORS } from './discovery/selectors';
export { createExecCommandWriter, createPasteEventWriter } from './writing/editor-writer';
export type { EditorWriter } from './writing/editor-writer';
