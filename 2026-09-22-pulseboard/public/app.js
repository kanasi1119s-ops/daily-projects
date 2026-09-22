(function () {
  'use strict';

  const grid = document.getElementById('monitorGrid');
  const incidentListEl = document.getElementById('incidentList');
  const addForm = document.getElementById('addForm');
  const nameInput = document.getElementById('nameInput');
  const urlInput = document.getElementById('urlInput');
  const webhookInput = document.getElementById('webhookInput');
  const intervalInput = document.getElementById('intervalInput');
  const formMsg = document.getElementById('formMsg');
  const planBadge = document.getElementById('planBadge');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const upgradeModal = document.getElementById('upgradeModal');
  const cancelUpgrade = document.getElementById('cancelUpgrade');
  const confirmUpgrade = document.getElementById('confirmUpgrade');

  const STATUS_LABEL = { up: '稼働中', down: '停止', pending: '確認待ち' };

  function fmtTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function renderMonitors(data) {
    const { plan, limit, monitors } = data;
    planBadge.textContent = plan === 'pro' ? 'Pro プラン' : `Free プラン (${monitors.length}/${limit})`;
    planBadge.className = 'badge ' + (plan === 'pro' ? 'pro' : 'free');
    upgradeBtn.classList.toggle('hidden', plan === 'pro');

    if (!monitors.length) {
      grid.innerHTML = '<p class="empty-state">監視対象がまだありません。上のフォームから追加してください。</p>';
      return;
    }

    grid.innerHTML = monitors
      .map((m) => {
        const statusClass = m.status;
        const uptime = m.uptimePct === null ? '-' : `${m.uptimePct}%`;
        const stats = m.uptimeStats || {};
        const pct = (s) => (s && s.pct !== null && s.pct !== undefined ? `${s.pct}%` : '-');
        const intervalLabel = m.intervalMs ? `${Math.round(m.intervalMs / 1000)}秒` : '全体設定';
        return `
        <div class="monitor-card" data-id="${m.id}">
          <div class="top-row">
            <div>
              <div class="monitor-name">${escapeHtml(m.name)}</div>
              <div class="monitor-url">${escapeHtml(m.url)}</div>
            </div>
            <span class="status-pill ${statusClass}"><span class="dot"></span>${STATUS_LABEL[m.status]}</span>
          </div>
          <div class="monitor-meta">
            <div>稼働率(直近): ${uptime}</div>
            <div>応答: ${m.lastResponseTimeMs !== null ? m.lastResponseTimeMs + 'ms' : '-'}</div>
            <div>最終確認: ${fmtTime(m.lastCheckedAt)}</div>
            <div>コード: ${m.lastStatusCode ?? (m.lastError || '-')}</div>
            <div>間隔: ${intervalLabel}</div>
          </div>
          <div class="uptime-long-term">
            <div><span class="stat-label">24h</span><span class="stat-value">${pct(stats.last24h)}</span></div>
            <div><span class="stat-label">7日</span><span class="stat-value">${pct(stats.last7d)}</span></div>
            <div><span class="stat-label">30日</span><span class="stat-value">${pct(stats.last30d)}</span></div>
            <div><span class="stat-label">全期間</span><span class="stat-value">${pct(stats.allTime)}</span></div>
          </div>
          ${m.webhookUrl ? '<div class="monitor-webhook-indicator">🔔 Webhook通知 設定済み</div>' : ''}
          <div class="monitor-actions">
            <button data-action="check" data-id="${m.id}">今すぐ確認</button>
            <button data-action="edit" data-id="${m.id}">編集</button>
            <button data-action="delete" data-id="${m.id}" class="danger">削除</button>
          </div>
        </div>`;
      })
      .join('');
  }

  function renderIncidents(incidents) {
    if (!incidents.length) {
      incidentListEl.innerHTML = '<li class="empty-state" style="border:none;">まだインシデントはありません</li>';
      return;
    }
    incidentListEl.innerHTML = incidents
      .map((i) => {
        const typeClass = i.type === 'down' ? 'type-down' : 'type-recovered';
        const label = i.type === 'down' ? '停止検知' : '復旧';
        return `<li><span>${escapeHtml(i.monitorName)} — <span class="${typeClass}">${label}</span></span><span>${fmtTime(i.timestamp)}</span></li>`;
      })
      .join('');
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function refresh() {
    try {
      const [monitorsRes, incidentsRes] = await Promise.all([
        fetch('/api/monitors'),
        fetch('/api/incidents'),
      ]);
      const monitorsData = await monitorsRes.json();
      const incidents = await incidentsRes.json();
      renderMonitors(monitorsData);
      renderIncidents(incidents);
    } catch (err) {
      grid.innerHTML = `<p class="empty-state">読み込みに失敗しました: ${escapeHtml(err.message)}</p>`;
    }
  }

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formMsg.textContent = '';
    formMsg.classList.remove('error');
    try {
      const payload = { name: nameInput.value, url: urlInput.value };
      if (webhookInput && webhookInput.value.trim()) payload.webhookUrl = webhookInput.value.trim();
      if (intervalInput && intervalInput.value) payload.intervalMs = Number(intervalInput.value) * 1000;

      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        formMsg.textContent = body.error || '追加に失敗しました';
        formMsg.classList.add('error');
        return;
      }
      nameInput.value = '';
      urlInput.value = '';
      if (webhookInput) webhookInput.value = '';
      if (intervalInput) intervalInput.value = '';
      formMsg.textContent = '追加しました。数秒後に確認結果が反映されます。';
      await refresh();
    } catch (err) {
      formMsg.textContent = '通信エラー: ' + err.message;
      formMsg.classList.add('error');
    }
  });

  grid.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'delete') {
      if (!confirm('この監視対象を削除しますか？')) return;
      await fetch(`/api/monitors/${id}`, { method: 'DELETE' });
      await refresh();
    } else if (btn.dataset.action === 'check') {
      btn.disabled = true;
      btn.textContent = '確認中...';
      await fetch(`/api/monitors/${id}/check`, { method: 'POST' });
      await refresh();
    } else if (btn.dataset.action === 'edit') {
      await editMonitor(id);
    }
  });

  async function editMonitor(id) {
    const monitorsRes = await fetch('/api/monitors');
    const { monitors } = await monitorsRes.json();
    const monitor = monitors.find((m) => String(m.id) === String(id));
    if (!monitor) return;

    const newWebhook = window.prompt(
      'Webhook URL（up/down切り替わり時にPOST。空欄で解除）:',
      monitor.webhookUrl || ''
    );
    if (newWebhook === null) return; // cancelled

    const currentSeconds = monitor.intervalMs ? String(Math.round(monitor.intervalMs / 1000)) : '';
    const newIntervalStr = window.prompt('チェック間隔（秒、5〜86400。空欄で全体設定を使用）:', currentSeconds);
    if (newIntervalStr === null) return; // cancelled

    const payload = {
      webhookUrl: newWebhook.trim() === '' ? null : newWebhook.trim(),
      intervalMs: newIntervalStr.trim() === '' ? null : Number(newIntervalStr.trim()) * 1000,
    };

    const res = await fetch(`/api/monitors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || '更新に失敗しました');
      return;
    }
    await refresh();
  }

  upgradeBtn.addEventListener('click', () => upgradeModal.classList.remove('hidden'));
  cancelUpgrade.addEventListener('click', () => upgradeModal.classList.add('hidden'));
  confirmUpgrade.addEventListener('click', async () => {
    await fetch('/api/plan/upgrade', { method: 'POST' });
    upgradeModal.classList.add('hidden');
    await refresh();
  });

  refresh();
  setInterval(refresh, 5000);
})();
