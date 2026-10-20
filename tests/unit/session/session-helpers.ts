import type { ComposerRef, PreparedAction } from '@writehand/contracts';
import {
  createSession,
  prepareAction,
  reduceSession,
  type SessionEvent,
  type SessionState,
  type SourceBinding,
} from '@writehand/core';

import { scopeA, threadA } from '../../fixtures/synthetic-mail/threads';
import { testDependencies } from '../test-dependencies';

export const composerRef: ComposerRef = { scope: scopeA, composerKey: 'c1', threadKey: 'thread-a' };

export function reduceAll(state: SessionState, events: SessionEvent[]): SessionState {
  return events.reduce(reduceSession, state);
}

export function newSession(): SessionState {
  return createSession({
    sessionId: 's1',
    thread: threadA,
    defaults: { targetLanguage: 'en', tone: 'neutral' },
  });
}

export const selectionBinding: Extract<SourceBinding, { kind: 'draft-selection' }> = {
  kind: 'draft-selection',
  composerRef,
  composerRevision: 5,
  selectionId: 'sel-1',
  loadedText: 'toplantı yarın olsun mu',
};

export function prepareFrom(state: SessionState): PreparedAction {
  const result = prepareAction(
    {
      sessionId: state.sessionId,
      formRevision: state.formRevision,
      draft: {
        operation: state.form.operation,
        source: { origin: 'draft-selection', text: state.form.sourceText },
        instruction: state.form.instruction,
        targetLanguage: state.form.targetLanguage,
        tone: state.form.tone,
        context: null,
        target: null,
      },
    },
    testDependencies(),
  );
  if (!result.ok) throw new Error('unexpected validation error');
  return result.value;
}

/** A session whose source came from a selection and whose sample result has reached the preview. */
export function sessionWithPreview(text = 'Toplantıyı yarın yapabiliriz.'): SessionState {
  const loaded = reduceAll(newSession(), [
    {
      type: 'source-loaded',
      operationId: null,
      text: selectionBinding.loadedText,
      binding: selectionBinding,
    },
  ]);
  const action = prepareFrom(loaded);
  return reduceAll(loaded, [
    { type: 'action-prepared', action },
    {
      type: 'result-received',
      candidate: {
        requestId: action.requestId,
        sessionId: action.sessionId,
        formRevision: action.formRevision,
        text,
        sample: true,
      },
    },
  ]);
}
