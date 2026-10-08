(function () {
  var C = window.FLCore;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function val(id) { var e = $(id); return e.type === 'checkbox' ? e.checked : e.value; }
  var F = ['clientName','freelancerName','orderDate','deliveryDate','payDate','content','place','reward','rewardUndetermined','rewardMethod','nonCash','nonCashMethod','inspection','inspectionDate'];

  $('runTerms').onclick = function () {
    var i = {}; F.forEach(function (k) { i[k] = val(k); });
    var r = C.checkTerms(i), h = '';
    if (r.ok) h += '<p class="ok">✔ 必須項目は入力済みで、明らかな不整合は検出されませんでした（適法性の保証ではありません）。</p>';
    r.missing.forEach(function (m) { h += '<p class="ng">未記入: ' + esc(m) + '</p>'; });
    r.warnings.forEach(function (w) { h += '<p class="ng">⚠ ' + esc(w) + '</p>'; });
    h += '<pre>' + esc(C.buildNotice(i)) + '</pre>';
    $('termsOut').innerHTML = h;
  };

  $('runPay').onclick = function () {
    var rule = { closingDay: $('closingDay').value === 'end' ? 'end' : +$('closingDay').value,
      payMonthOffset: +$('payMonthOffset').value, payDay: $('payDay').value === 'end' ? 'end' : +$('payDay').value };
    var y = +$('year').value;
    if (!(y >= 2024 && y <= 2100)) { $('payOut').innerHTML = '<p class="ng">検証年は2024〜2100で指定してください。</p>'; return; }
    var r = C.verifyPaymentRuleYear(rule, y), h = '';
    h += r.ok ? '<p class="ok">✔ ' + y + '年は全ての受領日で60日（2か月以内運用含む）に収まりました。</p>'
      : '<p class="ng">✖ 期限を超える受領日があります。</p>';
    r.months.filter(function (m) { return !m.ok; }).forEach(function (m) {
      h += '<p class="ng">' + m.month + '月: ' + m.violations + '日分が超過（例: ' + esc(m.worstViolation.receipt) + ' 受領 → ' + esc(m.worstViolation.payment) + ' 支払 = ' + m.worstViolation.elapsed + '日）</p>';
    });
    $('payOut').innerHTML = h;
  };

  var box = $('prohibited');
  C.PROHIBITED.forEach(function (t, n) {
    var d = document.createElement('div'); d.className = 'chk';
    d.innerHTML = '<input type="checkbox" id="p' + n + '"><label for="p' + n + '">' + esc(t) + '</label>';
    box.appendChild(d);
    d.firstChild.onchange = function () {
      var c = C.PROHIBITED.filter(function (_, k) { return $('p' + k).checked; }).length;
      $('prohOut').innerHTML = c ? '<p class="ng">⚠ ' + c + '件に該当の可能性があります。取引内容を見直し、公的窓口・専門家へ相談してください。</p>' : '';
    };
  });
})();
