<script setup lang="ts">
import {
  AI_MODES,
  API_PROVIDER_DETAILS,
  API_PROVIDERS,
  CLAUDE_CODE_SETUP_URL,
  type AiMode,
} from '@writehand/contracts';
import { useId } from 'vue';

import type { AiGuideItem, AiText } from '../ai-text';
import AppIcon from './AppIcon.vue';
import type { IconName } from './icons';

const props = defineProps<{ text: AiText; mode: AiMode | null }>();

const titleId = useId();
const ICONS: Record<AiMode, IconName> = { chatgpt: 'chat', 'api-key': 'key', 'claude-code': 'terminal' };
/** Official pages: where to create a key with each provider, Anthropic's Claude Code setup. */
function links(mode: AiMode): { href: string; label: string }[] {
  if (mode === 'api-key')
    return API_PROVIDERS.map((provider) => ({
      href: API_PROVIDER_DETAILS[provider].keysUrl,
      label: props.text.createKey(API_PROVIDER_DETAILS[provider].name),
    }));
  const label = props.text.guide.methods[mode].linkLabel;
  return mode === 'claude-code' && label ? [{ href: CLAUDE_CODE_SETUP_URL, label }] : [];
}
// The selected method's section starts open; after that the user decides.
const initiallyOpen = props.mode;

/** Parts wrapped in `...` are shown as commands. */
function parts(line: string): { code: boolean; text: string }[] {
  return line.split('`').map((text, index) => ({ code: index % 2 === 1, text }));
}

function sections(item: AiGuideItem) {
  return [
    {
      key: 'requirements',
      label: props.text.guide.requirementsLabel,
      lines: item.requirements,
      ordered: false,
    },
    { key: 'steps', label: props.text.guide.stepsLabel, lines: item.steps, ordered: true },
    { key: 'notes', label: props.text.guide.notesLabel, lines: item.notes, ordered: false },
  ].filter((section) => section.lines.length > 0);
}
</script>

<template>
  <section class="ew-settings-card ew-ai-guide" :aria-labelledby="titleId">
    <header class="ew-settings-card__header">
      <span class="ew-settings-card__icon"><AppIcon name="book" :size="18" /></span>
      <div class="ew-settings-card__heading">
        <h2 :id="titleId" class="ew-settings-card__title">{{ text.guide.title }}</h2>
        <p class="ew-settings-card__description">{{ text.guide.intro }}</p>
      </div>
    </header>
    <div class="ew-ai-guide__list">
      <details
        v-for="method in AI_MODES"
        :key="method"
        class="ew-ai-guide__item"
        :data-mode="method"
        :open="initiallyOpen === method"
      >
        <summary class="ew-ai-guide__summary">
          <span class="ew-ai-guide__glyph"><AppIcon :name="ICONS[method]" :size="16" /></span>
          <span class="ew-ai-guide__heading">
            <span class="ew-ai-guide__title">
              {{ text.guide.methods[method].title }}
              <span v-if="method === props.mode" class="ew-badge ew-badge--accent">{{
                text.guide.current
              }}</span>
            </span>
            <span class="ew-ai-guide__lead">{{ text.guide.methods[method].summary }}</span>
          </span>
          <AppIcon class="ew-ai-guide__chevron" name="chevronDown" :size="16" />
        </summary>
        <div class="ew-ai-guide__body">
          <div
            v-for="section in sections(text.guide.methods[method])"
            :key="section.key"
            class="ew-ai-guide__section"
          >
            <h3 class="ew-ai-guide__label">{{ section.label }}</h3>
            <component
              :is="section.ordered ? 'ol' : 'ul'"
              class="ew-ai-guide__lines"
              :data-kind="section.key"
            >
              <li v-for="(line, index) in section.lines" :key="index">
                <template v-for="(part, partIndex) in parts(line)" :key="partIndex">
                  <code v-if="part.code">{{ part.text }}</code>
                  <template v-else>{{ part.text }}</template>
                </template>
              </li>
            </component>
          </div>
          <a
            v-for="link in links(method)"
            :key="link.href"
            class="ew-ai-guide__link"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ link.label }}
            <AppIcon name="external" :size="14" />
          </a>
        </div>
      </details>
      <details class="ew-ai-guide__item" data-mode="helper">
        <summary class="ew-ai-guide__summary">
          <span class="ew-ai-guide__glyph"><AppIcon name="laptop" :size="16" /></span>
          <span class="ew-ai-guide__heading">
            <span class="ew-ai-guide__title">{{ text.guide.helper.title }}</span>
            <span class="ew-ai-guide__lead">{{ text.guide.helper.summary }}</span>
          </span>
          <AppIcon class="ew-ai-guide__chevron" name="chevronDown" :size="16" />
        </summary>
        <div class="ew-ai-guide__body">
          <div v-for="section in sections(text.guide.helper)" :key="section.key" class="ew-ai-guide__section">
            <h3 class="ew-ai-guide__label">{{ section.label }}</h3>
            <component
              :is="section.ordered ? 'ol' : 'ul'"
              class="ew-ai-guide__lines"
              :data-kind="section.key"
            >
              <li v-for="(line, index) in section.lines" :key="index">{{ line }}</li>
            </component>
          </div>
        </div>
      </details>
    </div>
  </section>
</template>
