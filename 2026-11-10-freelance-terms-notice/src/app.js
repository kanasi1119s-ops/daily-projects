(function () {
  'use strict';
  var T = window.TermsLogic;
  var $ = function (id) { return document.getElementById(id); };
  var ids = ['clientName','freelancerName','clientContact','freelancerContact','orderDate','deliveryDate','scope','deliverable',
    'place','inspectionDate','amount','taxMode','taxRate','paymentDate','amountNote','paymentMethod','transferFeeBy',
    'paymentMethodDetail','ipTerms'];

  function read() {
    var o = {};
    ids.forEach(function (k) { o[k] = $(k).value; });
    o.hasInspection = $('hasInspection').checked;
    return o;
  }
  function sync() {
    $('inspWrap').hidden = !$('hasInspection').checked;
    $('pmWrap').hidden = $('paymentMethod').value === 'bank';
  }
  function show(list, cls) {
    var ul = $('msgs');
    list.forEach(function (m) { var li = document.createElement('li'); li.className = cls; li.textContent = m; ul.appendChild(li); });
  }
  $('hasInspection').addEventListener('change', sync);
  $('paymentMethod').addEventListener('change', sync);
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = read();
    var v = T.validate(input);
    $('msgs').textContent = ''; $('copy').textContent = 'テキストをコピー';
    show(v.errors, 'e'); show(v.warnings, 'w');
    $('result').hidden = v.errors.length > 0;
    if (v.errors.length === 0) $('out').textContent = T.buildDocument(input);
  });
  $('copy').addEventListener('click', function () {
    var t = $('out').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { $('copy').textContent = 'コピーしました'; });
  });
  $('print').addEventListener('click', function () { window.print(); });
  sync();
})();
