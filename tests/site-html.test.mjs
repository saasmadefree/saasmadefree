import { describe, it, expect } from 'vitest';
import { escapeHtml, jsonLdScript, languageName, renderBreadcrumb, verdictBadge } from '../scripts/lib/site-html.mjs';

describe('escapeHtml', () => {
  it('échappe les cinq caractères sensibles', () => {
    expect(escapeHtml(`<a href="x">it's & "quoted"</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;it&#39;s &amp; &quot;quoted&quot;&lt;/a&gt;'
    );
  });
});

describe('jsonLdScript', () => {
  it("échappe '<' pour qu'une séquence </script> dans les données ne casse jamais le bloc", () => {
    const html = jsonLdScript({ name: '</script><script>alert(1)</script>' });
    expect(html).not.toContain('</script><script>alert');
    expect(html).toContain('\\u003c/script>');
  });

  it('reste un JSON valide une fois désérialisé', () => {
    const data = { a: 1, b: ['x', 'y'] };
    const html = jsonLdScript(data);
    const inner = html.replace('<script type="application/ld+json">\n', '').replace('\n</script>', '');
    expect(JSON.parse(inner)).toEqual(data);
  });
});

describe('languageName', () => {
  it('connaît les sept langues du projet', () => {
    expect(languageName('en')).toBe('English');
    expect(languageName('fr')).toBe('Français');
  });

  it('retombe sur le code lui-même pour une langue inconnue', () => {
    expect(languageName('xx')).toBe('xx');
  });
});

describe('renderBreadcrumb', () => {
  it('rend le dernier élément comme la page courante, sans lien', () => {
    const html = renderBreadcrumb([
      { label: 'Directory', href: '/en/' },
      { label: 'Notion', href: '/en/tools/notion' },
    ]);
    expect(html).toContain('<a href="/en/">Directory</a>');
    expect(html).toContain('<span aria-current="page">Notion</span>');
    expect(html).not.toContain('<a href="/en/tools/notion">Notion</a>');
  });
});

describe('verdictBadge', () => {
  it('porte la classe du verdict et le texte échappé', () => {
    expect(verdictBadge('yes', 'Yes')).toBe('<span class="badge yes">Yes</span>');
  });

  it('accepte un modificateur optionnel pour la variante agrandie', () => {
    expect(verdictBadge('kinda', 'Partly', 'badge-lg')).toBe('<span class="badge kinda badge-lg">Partly</span>');
  });

  it('échappe le texte du label', () => {
    expect(verdictBadge('no', '<script>')).toBe('<span class="badge no">&lt;script&gt;</span>');
  });
});
