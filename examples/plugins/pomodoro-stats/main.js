// Example Nexus Plugin: Focus Stats & Desktop Widget
// Demonstrates sandboxed KV persistence, notifications permission, and shared app + widget code.

export async function mount(root, ctx) {
  const isWidget = Boolean(ctx.widget);

  async function loadStats() {
    const data = await ctx.storage.kv.get('stats', { sessions: 0, minutes: 0, lastDay: '' });
    return data && typeof data === 'object' ? data : { sessions: 0, minutes: 0, lastDay: '' };
  }

  async function render() {
    const stats = await loadStats();
    const today = new Date().toISOString().slice(0, 10);
    root.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;gap:10px;height:100%;align-content:start;';

    const title = document.createElement('div');
    title.style.cssText =
      'font-weight:700;font-size:' +
      (isWidget ? '13px' : '18px') +
      ';display:flex;justify-content:space-between;align-items:center;';
    title.textContent = ctx.i18n.locale === 'de' ? 'Fokus-Sitzungen' : 'Focus Sessions';
    wrap.appendChild(title);

    const kpi = document.createElement('div');
    kpi.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';

    for (const [label, value] of [
      [ctx.i18n.locale === 'de' ? 'Sitzungen' : 'Sessions', String(stats.sessions)],
      [ctx.i18n.locale === 'de' ? 'Minuten' : 'Minutes', String(stats.minutes)],
    ]) {
      const card = document.createElement('div');
      card.style.cssText =
        'padding:10px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border);display:grid;gap:2px;';
      const num = document.createElement('strong');
      num.style.cssText = 'font-size:' + (isWidget ? '18px' : '24px') + ';color:var(--accent);';
      num.textContent = value;
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:11px;color:var(--text-3);';
      lbl.textContent = label;
      card.append(num, lbl);
      kpi.appendChild(card);
    }
    wrap.appendChild(kpi);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

    const logBtn = document.createElement('button');
    logBtn.className = 'primary';
    logBtn.textContent = ctx.i18n.locale === 'de' ? '+25 Min. loggen' : '+Log 25m';
    logBtn.addEventListener('click', async () => {
      const current = await loadStats();
      const next = {
        sessions: Number(current.sessions || 0) + 1,
        minutes: Number(current.minutes || 0) + 25,
        lastDay: today,
      };
      await ctx.storage.kv.set('stats', next);
      try {
        await ctx.notify({
          title: 'Focus Stats',
          body:
            ctx.i18n.locale === 'de'
              ? `25 Minuten protokolliert (${next.sessions} insgesamt)`
              : `Logged 25 minutes (${next.sessions} total sessions)`,
        });
      } catch {
        // Notification permission denied by user — KV still saved.
      }
      await render();
    });
    actions.appendChild(logBtn);

    if (!isWidget) {
      const resetBtn = document.createElement('button');
      resetBtn.textContent = ctx.i18n.locale === 'de' ? 'Zurücksetzen' : 'Reset';
      resetBtn.addEventListener('click', async () => {
        if (await ctx.dialog.confirm('Reset Focus Stats counter?')) {
          await ctx.storage.kv.set('stats', { sessions: 0, minutes: 0, lastDay: '' });
          await render();
        }
      });
      actions.appendChild(resetBtn);
    }

    wrap.appendChild(actions);
    root.appendChild(wrap);
  }

  await render();
}
