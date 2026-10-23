(function () {
  const form = document.getElementById('f');
  const out = document.getElementById('out');
  const msgs = document.getElementById('msgs');

  function read() {
    const o = {};
    for (const el of form.elements) if (el.name) o[el.name] = el.value;
    return o;
  }
  function esc(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function render() {
    const v = read();
    const r = NoticeCore.validate(v);
    msgs.innerHTML =
      r.errors.map((e) => `<li class="err">${esc(e)}</li>`).join('') +
      r.warnings.map((w) => `<li class="warn">${esc(w)}</li>`).join('');
    out.textContent = r.ok ? NoticeCore.buildNotice(v) : '必須項目を入力すると明示書が生成されます。';
    document.getElementById('copy').disabled = !r.ok;
    document.getElementById('print').disabled = !r.ok;
  }
  form.addEventListener('input', render);
  document.getElementById('copy').addEventListener('click', () => {
    navigator.clipboard.writeText(out.textContent).then(() => alert('コピーしました'));
  });
  document.getElementById('print').addEventListener('click', () => window.print());
  render();
})();
