import type { RuntimeRequestType } from '@email-writer/contracts';
import type { MessageSender } from './runtime-messaging';

/** Management is restricted to extension pages; mailbox scripts only generate/cancel and read a safe summary. */
export function createAiSenderPolicy(options: {
  extensionId: string;
  isOwnPage: (sender: MessageSender) => boolean;
  isMailUrl: (url: string) => boolean;
}) {
  return (sender: MessageSender, type: RuntimeRequestType): boolean => {
    if (options.isOwnPage(sender)) return type !== 'AI_GENERATE' && type !== 'AI_CANCEL';
    return (
      sender.id === options.extensionId &&
      sender.tab?.id !== undefined &&
      typeof sender.url === 'string' &&
      options.isMailUrl(sender.url) &&
      ['AI_SUMMARY', 'AI_GENERATE', 'AI_CANCEL', 'OPEN_OPTIONS'].includes(type)
    );
  };
}
