// Seul fichier de l'extension exécuté dans le contexte des pages visitées.
// Il lit location.hostname, et rien d'autre de la page.
// Il n'inspecte jamais le DOM de la page : il n'écrit que son propre élément,
// isolé dans un Shadow DOM.

(async () => {
  const host = location.hostname;
  const entry = await chrome.runtime.sendMessage({ type: 'lookup', host });
  if (!entry) return; // 99,99 % des pages s'arrêtent ici, sans toucher au document

  const hidden = await chrome.runtime.sendMessage({ type: 'hidden', slug: entry.slug });
  if (hidden) return;

  const mount = document.createElement('div');
  mount.id = 'smf-root';
  mount.style.cssText = 'all:initial;position:fixed;z-index:2147483647;right:16px;bottom:16px;';
  const shadow = mount.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .pill { display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:999px;
      font:500 13px/1 ui-sans-serif,system-ui,sans-serif; color:#fff; background:#111;
      box-shadow:0 4px 16px rgba(0,0,0,.28); cursor:pointer; border:1px solid #2a2a2a; }
    .dot { width:8px; height:8px; border-radius:50%; }
    .yes { background:#22c55e } .kinda { background:#f59e0b } .no { background:#ef4444 }
    .close { margin-left:4px; opacity:.5; padding:0 2px; }
    .close:hover { opacity:1 }
    @media (prefers-reduced-motion: no-preference) {
      .pill { transition: transform .15s ease }
      .pill:hover { transform: translateY(-1px) }
    }
  `;

  const pill = document.createElement('div');
  pill.className = 'pill';
  pill.setAttribute('role', 'button');
  pill.setAttribute('tabindex', '0');
  pill.setAttribute('aria-label', chrome.i18n.getMessage('pillAria'));

  const dot = document.createElement('span');
  dot.className = `dot ${entry.verdict}`;

  const label = document.createElement('span');
  label.textContent = chrome.i18n.getMessage(`verdict_${entry.verdict}`);

  const close = document.createElement('span');
  close.className = 'close';
  close.textContent = '×';
  close.setAttribute('role', 'button');
  // tabindex indispensable : sans lui, un utilisateur au clavier ne peut pas
  // retirer une pastille injectée dans une page qu'il n'a pas demandé à modifier.
  close.setAttribute('tabindex', '0');
  close.setAttribute('aria-label', chrome.i18n.getMessage('hideHere'));

  const open = () => window.open(
    chrome.runtime.getURL(`popup/popup.html?slug=${encodeURIComponent(entry.slug)}`),
    '_blank', 'noopener'
  );

  pill.addEventListener('click', (event) => {
    if (event.target === close) return;
    open();
  });
  pill.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
  });
  const dismiss = async (event) => {
    event.stopPropagation();
    // Après une mise à jour de l'extension, un ancien script de contenu reste
    // attaché à la page et sendMessage rejette. Sans ce filet, le clic sur la
    // croix ne ferait plus rien du tout : retirer la pastille prime.
    try {
      await chrome.runtime.sendMessage({ type: 'hide', slug: entry.slug });
    } catch {
      // le masquage durable est perdu, mais la pastille disparaît quand même
    }
    mount.remove();
  };

  close.addEventListener('click', dismiss);
  close.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dismiss(event);
    }
  });

  pill.append(dot, label, close);
  shadow.append(style, pill);
  document.documentElement.append(mount);
})();
