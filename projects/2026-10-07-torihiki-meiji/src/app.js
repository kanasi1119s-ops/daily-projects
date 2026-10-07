import { validate, generateDocument, latestPaymentDate, formatJa } from './logic.js';

const $ = (id) => document.getElementById(id);
const form = $('form');

function readForm() {
  const g = (id) => $(id).value;
  const c = (id) => $(id).checked;
  return {
    clientName: g('clientName'),
    freelancerName: g('freelancerName'),
    orderDate: g('orderDate'),
    workDescription: g('workDescription'),
    deliveryDate: g('deliveryDate'),
    deliveryPlace: g('deliveryPlace'),
    inspect: c('inspect'),
    inspectionDate: g('inspectionDate'),
    amount: g('amount'),
    taxIncluded: c('taxIncluded'),
    amountUndecided: c('amountUndecided'),
    amountMethod: g('amountMethod'),
    paymentDate: g('paymentDate'),
    nonCash: c('nonCash'),
    nonCashMethod: g('nonCashMethod'),
  };
}

function fillList(el, items) {
  el.replaceChildren(...items.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
  el.hidden = items.length === 0;
}

function render() {
  const data = readForm();
  $('inspectionRow').hidden = !data.inspect;
  $('amountMethodRow').hidden = !data.amountUndecided;
  $('nonCashRow').hidden = !data.nonCash;
  $('amount').disabled = data.amountUndecided;
  const { errors, warnings } = validate(
    data.amountUndecided ? { ...data, amount: '0' } : data
  );
  fillList($('errors'), errors);
  fillList($('warnings'), warnings);
  $('limit').textContent = data.deliveryDate
    ? `支払期日の上限目安: ${formatJa(latestPaymentDate(data.deliveryDate)) || '-'}`
    : '';
  $('preview').textContent = generateDocument(data);
  $('copy').disabled = errors.length > 0;
  $('print').disabled = errors.length > 0;
}

form.addEventListener('input', render);
form.addEventListener('change', render);

$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('preview').textContent);
    $('status').textContent = 'コピーしました';
  } catch {
    $('status').textContent = 'コピーに失敗しました。プレビューを手動で選択してください';
  }
});
$('print').addEventListener('click', () => window.print());
$('reset').addEventListener('click', () => {
  form.reset();
  render();
  $('status').textContent = '';
});

render();
