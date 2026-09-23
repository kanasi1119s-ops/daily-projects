(function () {
  "use strict";

  const STORAGE_KEY = "invoicelite:draft:v1";

  const fields = [
    "docType", "issuerName", "issuerRegNo", "issuerAddress", "issuerContact",
    "clientName", "clientHonorific", "docNo", "issueDate", "dueDate", "notes",
  ];

  const yen = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");

  function defaultState() {
    return {
      docType: "見積書",
      issuerName: "",
      issuerRegNo: "",
      issuerAddress: "",
      issuerContact: "",
      clientName: "",
      clientHonorific: "御中",
      docNo: "",
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      notes: "",
      items: [
        { name: "", qty: 1, unit: "式", price: 0, tax: 10 },
      ],
    };
  }

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return defaultState();
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // localStorage unavailable (private mode, quota) — draft simply won't persist.
    }
  }

  function el(id) { return document.getElementById(id); }

  function renderForm() {
    fields.forEach((f) => {
      const node = el(f);
      if (node) node.value = state[f] ?? "";
    });
    renderItemRows();
  }

  function renderItemRows() {
    const tbody = el("itemRows");
    tbody.innerHTML = "";
    state.items.forEach((item, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="name-col"><input data-idx="${idx}" data-key="name" type="text" value="${escapeAttr(item.name)}"></td>
        <td class="qty-col"><input data-idx="${idx}" data-key="qty" type="number" min="0" step="1" value="${item.qty}"></td>
        <td class="unit-col"><input data-idx="${idx}" data-key="unit" type="text" value="${escapeAttr(item.unit)}"></td>
        <td class="price-col"><input data-idx="${idx}" data-key="price" type="number" min="0" step="1" value="${item.price}"></td>
        <td class="tax-col">
          <select data-idx="${idx}" data-key="tax">
            <option value="10" ${item.tax === 10 ? "selected" : ""}>10%</option>
            <option value="8" ${item.tax === 8 ? "selected" : ""}>8%</option>
            <option value="0" ${item.tax === 0 ? "selected" : ""}>非課税</option>
          </select>
        </td>
        <td><button type="button" class="rm-row-btn" data-idx="${idx}" title="削除">×</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function escapeAttr(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }
  function escapeText(s) {
    const d = document.createElement("div");
    d.textContent = String(s ?? "");
    return d.innerHTML;
  }

  function computeTotals() {
    let subtotal = 0, tax10Base = 0, tax8Base = 0;
    state.items.forEach((item) => {
      const amount = (Number(item.qty) || 0) * (Number(item.price) || 0);
      subtotal += amount;
      if (item.tax === 10) tax10Base += amount;
      else if (item.tax === 8) tax8Base += amount;
    });
    const tax10 = tax10Base * 0.10;
    const tax8 = tax8Base * 0.08;
    const total = subtotal + tax10 + tax8;
    return { subtotal, tax10, tax8, total, tax10Base, tax8Base };
  }

  function renderPreview() {
    el("pDocType").textContent = state.docType;
    document.title = `${state.docType || "書類"} - InvoiceLite`;
    el("pClientLine").textContent = `${state.clientName || "____"}　${state.clientHonorific}`;
    el("pDocNo").textContent = state.docNo || "-";
    el("pIssueDate").textContent = formatDate(state.issueDate);

    const dueWrap = el("pDueDateWrap");
    if (state.docType === "見積書") {
      dueWrap.firstChild.textContent = "有効期限：";
    } else {
      dueWrap.firstChild.textContent = "支払期限：";
    }
    el("pDueDate").textContent = formatDate(state.dueDate);

    el("pIssuerName").textContent = state.issuerName;
    el("pIssuerRegNo").textContent = state.issuerRegNo ? `登録番号：${state.issuerRegNo}` : "";
    el("pIssuerAddress").textContent = state.issuerAddress;
    el("pIssuerContact").textContent = state.issuerContact;

    const tbody = el("pItemRows");
    tbody.innerHTML = "";
    state.items.forEach((item) => {
      const amount = (Number(item.qty) || 0) * (Number(item.price) || 0);
      const taxLabel = item.tax === 0 ? "非課税" : `${item.tax}%`;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeText(item.name)}</td>
        <td>${escapeText(item.qty)}</td>
        <td>${escapeText(item.unit)}</td>
        <td>${yen(item.price)}</td>
        <td>${taxLabel}</td>
        <td>${yen(amount)}</td>
      `;
      tbody.appendChild(tr);
    });

    const totals = computeTotals();
    el("pSubtotal").textContent = yen(totals.subtotal);
    el("pTax10Row").style.display = totals.tax10Base > 0 ? "flex" : "none";
    el("pTax8Row").style.display = totals.tax8Base > 0 ? "flex" : "none";
    el("pTax10").textContent = yen(totals.tax10);
    el("pTax8").textContent = yen(totals.tax8);
    el("pTotal").textContent = yen(totals.total);

    el("pNotes").textContent = state.notes || "";
  }

  function formatDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function render() {
    renderPreview();
    saveState();
  }

  function bindEvents() {
    fields.forEach((f) => {
      const node = el(f);
      if (!node) return;
      node.addEventListener("input", () => {
        state[f] = node.value;
        render();
      });
    });

    el("itemRows").addEventListener("input", (e) => {
      const t = e.target;
      const idx = Number(t.getAttribute("data-idx"));
      const key = t.getAttribute("data-key");
      if (Number.isNaN(idx) || !key) return;
      const item = state.items[idx];
      item[key] = key === "qty" || key === "price" || key === "tax" ? Number(t.value) : t.value;
      render();
    });

    el("itemRows").addEventListener("click", (e) => {
      if (!e.target.classList.contains("rm-row-btn")) return;
      const idx = Number(e.target.getAttribute("data-idx"));
      if (state.items.length <= 1) return;
      state.items.splice(idx, 1);
      renderItemRows();
      render();
    });

    el("addRow").addEventListener("click", () => {
      state.items.push({ name: "", qty: 1, unit: "式", price: 0, tax: 10 });
      renderItemRows();
      render();
    });

    el("printBtn").addEventListener("click", () => window.print());

    el("resetBtn").addEventListener("click", () => {
      if (!confirm("入力内容をすべて消去して新規作成しますか？")) return;
      state = defaultState();
      renderForm();
      render();
    });
  }

  renderForm();
  bindEvents();
  render();
})();
