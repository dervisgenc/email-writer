// Gerçek Outlook sayfasını, eklentinin okuma koduyla inceleyen geliştirme aracı.
// `pnpm outlook:firefox` ile açılan Firefox'a WebDriver BiDi ile bağlanır.
//
// Kurallar: Yalnızca okur ve konuşma satırına tıklar. E-posta göndermez,
// yanıtlamaz, silmez, taşımaz; klavye olayı göndermez. Çıktılar maskelidir;
// gerçek içerik terminale veya diske yazılmaz (implementation_details.md §17.2).
//
// Kullanım:
//   pnpm outlook:inspect rows                 konuşma satırları
//   pnpm outlook:inspect open <sıra>          satıra tıklar, açılan konuşmayı okur
//   pnpm outlook:inspect read                 açık konuşmayı bağlantıyla okur
//   pnpm outlook:inspect selectors [anahtar]  her seçicinin ayrı eşleşme sayısı
//   pnpm outlook:inspect theme                Outlook tema renkleri
//   pnpm outlook:inspect layout               eklenti düğmelerinin konumu ve Outlook düğmeleriyle çakışma
//   pnpm outlook:inspect diagnose-reply       "Reply" geçişinde bağlantının durumunu kaydeder (boş taslak açar)
//   pnpm outlook:inspect structure [hedef]    anonim DOM yapısı (varsayılan: readingPane)
//     --bodies  gövdelerin içini de göster   --depth N   --lines N   --rows <css>
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { build } from 'vite';

import { unwrapScriptResult, withBidiSession } from '../../support/firefox/bidi-client.mjs';
import { isBidiListening } from '../../support/firefox/firefox-process.mjs';
import { LIVE_BIDI_PORT } from './live-config.mjs';

const PROBE_GLOBAL = '__emailWriterProbe';
const SANDBOX = 'email-writer-live-probe';
const OPEN_TIMEOUT_MS = 5_000;
const OPEN_SETTLE_MS = 500;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitUntil(check, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) {
      return true;
    }
    await sleep(200);
  }
  return false;
}

async function bundleProbe() {
  const output = await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      write: false,
      minify: false,
      target: 'firefox140',
      lib: {
        entry: resolve(import.meta.dirname, 'probe/probe.ts'),
        formats: ['iife'],
        name: PROBE_GLOBAL,
        fileName: 'probe',
      },
    },
  });
  return (Array.isArray(output) ? output[0] : output).output[0].code;
}

async function findOutlookContext(bidi) {
  const { contexts } = await bidi.send('browsingContext.getTree', { maxDepth: 0 });
  const outlook = contexts.find((context) => /^https:\/\/outlook\.[^/]+\/mail\//.test(context.url));
  if (outlook === undefined) {
    throw new Error('Outlook posta sekmesi bulunamadı. Pencere kapandıysa: pnpm outlook:firefox --restart');
  }
  return outlook.context;
}

function createProbeClient(bidi, context) {
  const target = { context, sandbox: SANDBOX };
  return {
    async install(code) {
      unwrapScriptResult(
        await bidi.send('script.evaluate', { expression: code, target, awaitPromise: false }),
      );
    },
    /**
     * Sandbox içindeki fonksiyonu çağırır; sonuç JSON olarak taşınır. Verilmeyen
     * argüman `undefined` kalır ki fonksiyonun varsayılan değeri kullanılsın.
     */
    async call(name, ...args) {
      const serialized = args.map((arg) => (arg === undefined ? 'undefined' : JSON.stringify(arg)));
      const call = `${PROBE_GLOBAL}.${name}(${serialized.join(', ')})`;
      const result = unwrapScriptResult(
        await bidi.send('script.evaluate', {
          expression: `Promise.resolve(${call}).then((value) => JSON.stringify(value ?? null))`,
          target,
          awaitPromise: true,
        }),
      );
      return JSON.parse(result.value);
    },
  };
}

async function clickAt(bidi, context, { x, y }) {
  await bidi.send('input.performActions', {
    context,
    actions: [
      {
        type: 'pointer',
        id: 'email-writer-mouse',
        parameters: { pointerType: 'mouse' },
        actions: [
          { type: 'pointerMove', x, y, origin: 'viewport' },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ],
  });
  await bidi.send('input.releaseActions', { context });
}

function printRows(rows) {
  if (rows.length === 0) {
    console.log('Konuşma satırı bulunamadı (--rows ile seçici verilebilir).');
    return;
  }
  for (const row of rows) {
    console.log(
      `${row.selected ? '▶' : ' '} ${String(row.index).padStart(3)}  ${row.conversationId ?? '(convid yok)'}  ${row.shape}`,
    );
  }
}

function printThreadReport(report) {
  console.log(`Sayfa: ${report.support} · konuşma anahtarı: ${report.threadKey ?? '—'}`);
  console.log(`Seçiciler: ${report.selectors.map((entry) => `${entry.key}=${entry.matches}`).join(' ')}`);
  const { thread } = report;
  if (thread === null) {
    console.log('Açık konuşma bulunamadı.');
    return;
  }
  if ('error' in thread) {
    console.log(`Okuma hatası: ${thread.error}`);
    return;
  }
  console.log(`Konu: ${thread.subject ?? '(bulunamadı)'}`);
  console.log(
    `Mesajlar: ${thread.messages.length} · etkin: ${thread.activeMessage === null ? 'belirlenemedi' : `#${thread.activeMessage}`}`,
  );
  for (const message of thread.messages) {
    console.log(
      `  #${message.order}  gönderen: ${message.sender ?? '—'} · tarih: ${message.sentAt ?? '—'} / ${message.sentAtText ?? '—'}`,
    );
    for (const block of message.blocks) {
      console.log(`      ${block.kind} (${block.certainty}, ${block.length} kr): ${block.shape}`);
    }
  }
  const { coverage, text } = thread;
  console.log(
    `Kapsam: ${coverage.status} · okunan ${coverage.readableMessageCount} · okunamayan ${coverage.knownUnreadableMessageCount ?? 'bilinmiyor'} · ${coverage.reasons.join(', ')}`,
  );
  const ratio = text.rendered === 0 ? '—' : `%${Math.round((text.extracted / text.rendered) * 100)}`;
  console.log(`Metin (boşluksuz karakter): okunan ${text.extracted} / ekranda ${text.rendered} (${ratio})`);
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    bodies: { type: 'boolean', default: false },
    depth: { type: 'string', default: '40' },
    lines: { type: 'string', default: '400' },
    rows: { type: 'string' },
  },
});
const [command = 'read', argument] = positionals;

if (!(await isBidiListening(LIVE_BIDI_PORT))) {
  console.error(`Firefox BiDi ${LIVE_BIDI_PORT} kapalı. Önce: pnpm outlook:firefox`);
  process.exit(1);
}

async function runCommand(bidi, context, probe) {
  switch (command) {
    case 'rows':
      printRows(await probe.call('rows', values.rows));
      break;
    case 'open': {
      const index = Number(argument);
      const point = Number.isInteger(index) ? await probe.call('rowClickPoint', index, values.rows) : null;
      if (point === null) {
        throw new Error(`Satır ${argument} bulunamadı veya güvenli tıklama noktası yok.`);
      }
      await probe.call('markReadingPane');
      await clickAt(bidi, context, point);
      if (!(await waitUntil(() => probe.call('targetRowSelected'), OPEN_TIMEOUT_MS))) {
        throw new Error('Tıklama hedef konuşmayı seçmedi; okuma yapılmadı.');
      }
      if (!(await waitUntil(() => probe.call('readingPaneChanged'), OPEN_TIMEOUT_MS))) {
        console.log('Not: okuma bölmesi değişmedi (aynı ileti zaten açık olabilir).');
      }
      // Gövdenin geç yüklenen bölümleri (ör. resim yer tutucuları) için kısa bekleme.
      await sleep(OPEN_SETTLE_MS);
      printThreadReport(await probe.call('readThread'));
      break;
    }
    case 'read':
      printThreadReport(await probe.call('readThread'));
      break;
    case 'structure': {
      const result = await probe.call(
        'structure',
        argument ?? 'readingPane',
        Number(values.depth),
        Number(values.lines),
        values.bodies,
      );
      console.log(result.found ? result.lines.join('\n') : `Hedef bulunamadı: ${argument ?? 'readingPane'}`);
      break;
    }
    case 'theme':
      console.log(JSON.stringify(await probe.call('theme'), null, 2));
      break;
    case 'layout':
      console.log(JSON.stringify(await probe.call('launcherLayout'), null, 2));
      break;
    case 'diagnose-reply': {
      // Mesaj gösterilirken bağlantıyı başlatır, "Reply"a basar ve geçişi kaydeder.
      // Gönder'e dokunmaz, yazı yazmaz; açılan boş taslak elle kapatılır.
      const start = await probe.call('watchStart');
      if (start.bodies === 0) {
        await probe.call('watchStop');
        throw new Error('Önce bir mesaj açın (okuma bölmesinde mesaj gövdesi yok).');
      }
      console.log(`başlangıç ${JSON.stringify(start)}`);
      const point = await probe.call('replyClickPoint');
      if (point === null) {
        await probe.call('watchStop');
        throw new Error('"Reply" düğmesi bulunamadı veya güvenli tıklama noktası yok.');
      }
      await clickAt(bidi, context, point);
      for (let elapsed = 250; elapsed <= 4000; elapsed += 250) {
        await sleep(250);
        console.log(`${String(elapsed).padStart(4)} ms ${JSON.stringify(await probe.call('watchState'))}`);
      }
      await probe.call('watchStop');
      break;
    }
    case 'selectors':
      for (const entry of await probe.call('selectorMatches', argument)) {
        console.log(`${entry.key} (${entry.status})`);
        for (const { selector, matches } of entry.selectors) {
          console.log(`  ${String(matches).padStart(4)}  ${selector}`);
        }
      }
      break;
    default:
      throw new Error(`Bilinmeyen komut: ${command}`);
  }
}

function explain(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /Maximum number of active sessions/.test(message)
    ? 'Firefox yarım kalmış bir otomasyon oturumu tutuyor. Yeniden başlatın: pnpm outlook:firefox --restart'
    : message;
}

try {
  await withBidiSession(LIVE_BIDI_PORT, async (bidi) => {
    const context = await findOutlookContext(bidi);
    const probe = createProbeClient(bidi, context);
    await probe.install(await bundleProbe());
    await runCommand(bidi, context, probe);
  });
} catch (error) {
  console.error(explain(error));
  process.exitCode = 1;
}
