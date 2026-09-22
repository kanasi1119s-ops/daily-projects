(function () {
  'use strict';

  const banner = document.getElementById('overallBanner');
  const grid = document.getElementById('statusGrid');
  const incidentListEl = document.getElementById('statusIncidentList');

  const STATUS_LABEL = { up: '稼働中', down: '停止', pending: '確認待ち' };
  const OVERALL_LABEL = { operational: 'すべてのサービスが正常に稼働しています', degraded: '一部のサービスで問題が発生しています', unknown: '状態を確認できませんでした' };

  function fmtTime(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function refresh() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();

      banner.className = 'overall-banner ' + data.overall;
      banner.textContent = OVERALL_LABEL[data.overall] || data.overall;

      if (!data.monitors.length) {
        grid.innerHTML = '<p class="empty-state">公開されている監視対象はありません。</p>';
      } else {
        grid.innerHTML = data.monitors
          .map((m) => {
            const stats = m.uptimeStats || {};
            const pct = (s) => (s && s.pct !== null && s.pct !== undefined ? `${s.pct}%` : '-');
            return `
          <div class="monitor-card">
            <div class="top-row">
              <div class="monitor-name">${escapeHtml(m.name)}</div>
              <span class="status-pill ${m.status}"><span class="dot"></span>${STATUS_LABEL[m.status]}</span>
            </div>
            <div class="monitor-meta">
              <div>稼働率(直近): ${m.uptimePct === null ? '-' : m.uptimePct + '%'}</div>
              <div>最終確認: ${fmtTime(m.lastCheckedAt)}</div>
            </div>
            <div class="uptime-long-term">
              <div><span class="stat-label">24h</span><span class="stat-value">${pct(stats.last24h)}</span></div>
              <div><span class="stat-label">7日</span><span class="stat-value">${pct(stats.last7d)}</span></div>
              <div><span class="stat-label">30日</span><span class="stat-value">${pct(stats.last30d)}</span></div>
              <div><span class="stat-label">全期間</span><span class="stat-value">${pct(stats.allTime)}</span></div>
            </div>
          </div>`;
          })
          .join('');
      }

      if (!data.incidents.length) {
        incidentListEl.innerHTML = '<li class="empty-state" style="border:none;">まだインシデントはありません</li>';
      } else {
        incidentListEl.innerHTML = data.incidents
          .map((i) => {
            const typeClass = i.type === 'down' ? 'type-down' : 'type-recovered';
            const label = i.type === 'down' ? '停止検知' : '復旧';
            return `<li><span>${escapeHtml(i.monitorName)} — <span class="${typeClass}">${label}</span></span><span>${fmtTime(i.timestamp)}</span></li>`;
          })
          .join('');
      }
    } catch (err) {
      grid.innerHTML = `<p class="empty-state">読み込みに失敗しました: ${escapeHtml(err.message)}</p>`;
    }
  }

  refresh();
  setInterval(refresh, 10000);
})();
