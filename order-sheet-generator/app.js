(function () {
  var form = document.getElementById('form');
  var out = document.getElementById('output');
  var msgs = document.getElementById('messages');
  var actions = document.getElementById('actions');

  function values() {
    var f = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      f[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return f;
  }

  function syncVisibility() {
    var f = values();
    document.getElementById('inspectionRow').hidden = !f.hasInspection;
    document.getElementById('feeFixed').hidden = f.feeType === 'method';
    document.getElementById('feeMethodRow').hidden = f.feeType !== 'method';
    document.getElementById('paymentDetailRow').hidden = f.paymentMethod !== 'other';
  }

  function addMsg(cls, text) {
    var li = document.createElement('li');
    li.className = cls;
    li.textContent = (cls === 'error' ? '【要修正】' : '【注意】') + text;
    msgs.appendChild(li);
  }

  form.addEventListener('change', syncVisibility);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = values();
    var r = OrderSheet.validate(f);
    msgs.textContent = '';
    Array.prototype.forEach.call(form.elements, function (el) { el.removeAttribute('aria-invalid'); });
    r.errors.forEach(function (x) {
      addMsg('error', x.message);
      if (form.elements[x.field]) form.elements[x.field].setAttribute('aria-invalid', 'true');
    });
    r.warnings.forEach(function (x) { addMsg('warning', x.message); });
    var ok = r.errors.length === 0;
    if (!ok && form.elements[r.errors[0].field]) form.elements[r.errors[0].field].focus();
    out.hidden = actions.hidden = !ok;
    if (ok) out.textContent = OrderSheet.generate(f);
  });

  document.getElementById('copy').addEventListener('click', function () {
    var btn = this;
    navigator.clipboard.writeText(out.textContent).then(function () {
      btn.textContent = 'コピーしました';
      setTimeout(function () { btn.textContent = 'コピー'; }, 1500);
    }, function () { btn.textContent = 'コピー失敗(手動で選択してください)'; });
  });
  document.getElementById('print').addEventListener('click', function () { window.print(); });
  if (!form.elements.orderDate.value) {
    var t = new Date();
    form.elements.orderDate.value = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }
  syncVisibility();
})();
