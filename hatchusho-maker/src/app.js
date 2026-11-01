(function () {
  'use strict';
  var L = window.HatchuLib, $ = function (id) { return document.getElementById(id); };
  var itemsEl = $('items');

  function addItem(name, qty, price) {
    var d = document.createElement('div'); d.className = 'item';
    d.innerHTML = '<input class="in" placeholder="品目" aria-label="品目"><input class="iq" inputmode="numeric" placeholder="数量" aria-label="数量">' +
      '<input class="ip" inputmode="numeric" placeholder="単価(円)" aria-label="単価"><button type="button" class="sub" aria-label="行を削除">×</button>';
    d.querySelector('.in').value = name || ''; d.querySelector('.iq').value = qty || ''; d.querySelector('.ip').value = price || '';
    d.querySelector('button').onclick = function () { if (itemsEl.children.length > 1) itemsEl.removeChild(d); };
    itemsEl.appendChild(d);
  }

  function collect() {
    var g = function (id) { return $(id).value; };
    var items = Array.prototype.map.call(itemsEl.children, function (r) {
      return { name: r.querySelector('.in').value, qty: r.querySelector('.iq').value, unitPrice: r.querySelector('.ip').value };
    });
    return { clientName: g('clientName'), freelancerName: g('freelancerName'), clientAddress: g('clientAddress'),
      clientInvoiceNo: g('clientInvoiceNo').trim(), orderDate: g('orderDate'), deliveryDate: g('deliveryDate'),
      paymentDueDate: g('paymentDueDate'), deliveryPlace: g('deliveryPlace'), workDescription: g('workDescription'),
      hasInspection: $('hasInspection').checked, inspectionDate: g('inspectionDate'), paymentMethod: g('paymentMethod'),
      paymentMethodNote: g('paymentMethodNote'), notes: g('notes'), items: items, taxRate: 0.1 };
  }

  $('add').onclick = function () { addItem(); };
  $('hasInspection').onchange = function () { $('insp').hidden = !this.checked; };
  $('paymentMethod').onchange = function () { $('pmn').hidden = this.value === 'cash'; };
  $('print').onclick = function () { window.print(); };
  $('f').onsubmit = function (e) {
    e.preventDefault();
    var d = collect(), v = L.validate(d), m = $('msg');
    var h = v.errors.map(function (x) { return '<div class="er">⚠ ' + L.esc(x) + '</div>'; }).join('') +
            v.warnings.map(function (x) { return '<div class="wn">※ ' + L.esc(x) + '</div>'; }).join('');
    m.innerHTML = h; m.hidden = !h;
    if (v.errors.length) { $('out').hidden = true; return; }
    $('preview').innerHTML = L.renderDocument(d); $('out').hidden = false;
  };
  addItem();
})();
