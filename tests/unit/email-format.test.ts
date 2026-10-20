import {
  isRichDocument,
  parseEmailMarkdown,
  renderEmailHtml,
  renderPlainText,
  renderVisibleText,
} from '@writehand/email-format';
import { describe, expect, it } from 'vitest';

const html = (markdown: string) => renderEmailHtml(parseEmailMarkdown(markdown), { locale: 'tr' });

describe('Email Markdown parsing', () => {
  it('writes paragraphs and line breaks line by line, as in an Outlook draft', () => {
    const document = parseEmailMarkdown(
      'Merhaba Ayşe,\n\nTeklifi ekte bulabilirsiniz.\nİyi çalışmalar,\nDeniz',
    );
    expect(isRichDocument(document)).toBe(false);
    expect(renderEmailHtml(document)).toBe(
      '<div>Merhaba Ayşe,</div><div><br></div><div>Teklifi ekte bulabilirsiniz.</div><div>İyi çalışmalar,</div><div>Deniz</div>',
    );
    expect(renderPlainText(document)).toBe(
      'Merhaba Ayşe,\n\nTeklifi ekte bulabilirsiniz.\nİyi çalışmalar,\nDeniz',
    );
  });

  it('formats bold, italic and safe links, and leaves underscores inside words alone', () => {
    expect(html('**Önemli:** toplantı *yarın*, dosya_adi_v2 ve [plan](https://example.test/plan)')).toBe(
      '<div><b>Önemli:</b> toplantı <i>yarın</i>, dosya_adi_v2 ve <a href="https://example.test/plan">plan</a></div>',
    );
  });

  it('keeps HTML from the model and dangerous links as text', () => {
    const output = html('<img src=x onerror=alert(1)> [tıkla](javascript:alert(1)) "a" & \'b\'');
    expect(output).toBe(
      '<div>&lt;img src=x onerror=alert(1)&gt; [tıkla](javascript:alert(1)) &quot;a&quot; &amp; &#39;b&#39;</div>',
    );
    expect(output).not.toContain('<img');
    expect(output).not.toContain('href="javascript');
  });

  it('recognizes bulleted and numbered lists, continuation lines and the start number', () => {
    const document = parseEmailMarkdown(
      'Gündem:\n- Bütçe\n- Takvim\n  ve sorumlular\n\n3. Üçüncü\n4. Dördüncü',
    );
    expect(document.blocks.map((block) => block.type)).toEqual(['paragraph', 'list', 'list']);
    expect(renderEmailHtml(document)).toContain(
      '<ul style="margin-top:0;margin-bottom:0"><li>Bütçe</li><li>Takvim<br>ve sorumlular</li></ul>',
    );
    expect(renderEmailHtml(document)).toContain('<ol start="3"');
    expect(renderPlainText(document)).toContain('- Takvim\nve sorumlular\n\n3. Üçüncü\n4. Dördüncü');
    // Text read back from the draft: bullets start with "- ", numbered items with their position (regardless of the start number).
    expect(renderVisibleText(document)).toBe(
      'Gündem:\n- Bütçe\n- Takvim\nve sorumlular\n1. Üçüncü\n2. Dördüncü',
    );
  });

  it('turns tables into bordered HTML tables with alignment, and into " | "-separated rows in plain text', () => {
    const document = parseEmailMarkdown('| Ürün | Fiyat |\n| --- | ---: |\n| A | 10 |\n| B \\| C | 20 |');
    const output = renderEmailHtml(document);
    expect(output).toMatch(
      /^<table style="border-collapse:collapse;border:1px solid #d1d1d1"><thead><tr><th style="[^"]*text-align:left[^"]*">Ürün<\/th>/,
    );
    expect(output).toContain('text-align:right;">10</td>'.replace(';">', '">'));
    expect(output).toContain('>B | C</td>');
    expect(renderPlainText(document)).toBe('Ürün | Fiyat\nA | 10\nB | C | 20');
  });

  it('turns a ```chart block into a bar chart and keeps an invalid chart as text', () => {
    const document = parseEmailMarkdown(
      'Satışlar:\n\n```chart\n{"title":"Çeyrek satışları","unit":"k€","data":[{"label":"Ç1","value":120},{"label":"Ç2","value":60}]}\n```',
    );
    expect(document.blocks[1]).toEqual({
      type: 'chart',
      chart: {
        title: 'Çeyrek satışları',
        unit: 'k€',
        data: [
          { label: 'Ç1', value: 120 },
          { label: 'Ç2', value: 60 },
        ],
      },
    });
    const output = renderEmailHtml(document, { locale: 'tr' });
    expect(output).toContain('<div><b>Çeyrek satışları</b></div>');
    expect(output).toContain('width:100%"><tr><td style="height:14px');
    expect(output).toContain('width:50%"><tr><td style="height:14px');
    expect(output).toContain('>120 k€</td>');
    expect(renderPlainText(document, { locale: 'tr' })).toBe(
      'Satışlar:\n\nÇeyrek satışları\nÇ1: 120 k€\nÇ2: 60 k€',
    );

    const invalid = parseEmailMarkdown('```chart\n{"data":"yok"}\n```');
    expect(invalid.blocks).toEqual([
      { type: 'paragraph', lines: [[{ type: 'text', text: '{"data":"yok"}' }]] },
    ]);
  });

  it('turns headings into bold lines and drops horizontal rules', () => {
    expect(html('# Özet\n---\nMetin')).toBe('<div><b>Özet</b></div><div><br></div><div>Metin</div>');
  });
});
