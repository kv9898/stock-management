import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import fuzzaldrin from "fuzzaldrin-plus";

import type { Product } from "../../types/product";

type Row = {
  id: string;
  product: string;          // product name
  qty: number | null;
  unitPrice: number | null; // per-unit price
  totalPrice: number | null;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// safe numeric parser: "" -> null, valid -> number
function parseNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function AddStockPane() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Row[]>([{ id: uid(), product: "", qty: null, unitPrice: null, totalPrice: null }]);
  const [recordAsTxn, setRecordAsTxn] = useState<boolean>(true);
  const [searchFocusId, setSearchFocusId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const list = await invoke<Product[]>("get_all_products");
      // sort alphabetically
      setProducts(
        [...list].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })
        )
      );
    })();
  }, []);

  const productNames = useMemo(() => products.map(p => p.name), [products]);

  // Fuzzy suggestions for a given input
  const getSuggestions = (input: string) => {
    const q = input.trim();
    if (!q) return productNames.slice(0, 20);
    return fuzzaldrin.filter(productNames, q).slice(0, 20);
  };

  const setRow = (id: string, updater: (r: Row) => Row) => {
    setRows(rs => rs.map(r => (r.id === id ? updater({ ...r }) : r)));
  };

  const addRow = () => setRows(rs => [...rs, { id: uid(), product: "", qty: null, unitPrice: null, totalPrice: null }]);
  const removeRow = (id: string) => setRows(rs => (rs.length === 1 ? rs : rs.filter(r => r.id !== id)));

  // Keep prices consistent:
  // - When qty changes: recompute total if unitPrice present; else recompute unitPrice if total present
  // - When unitPrice changes: recompute total if qty present
  // - When total changes: recompute unitPrice if qty present
  const onQtyChange = (id: string, qty: number | null) =>
    setRow(id, r => {
      r.qty = qty;
      if (qty && r.unitPrice != null) r.totalPrice = round2(qty * r.unitPrice);
      else if (qty && r.totalPrice != null) r.unitPrice = round2(r.totalPrice / qty);
      else if (!qty) {
        // qty is null: keep whichever field user typed last; do not recalc
      }
      return r;
    });

  const onUnitChange = (id: string, unit: number | null) =>
    setRow(id, r => {
      r.unitPrice = unit;
      if (r.qty && unit != null) r.totalPrice = round2(r.qty * unit);
      return r;
    });

  const onTotalChange = (id: string, total: number | null) =>
    setRow(id, r => {
      r.totalPrice = total;
      if (r.qty && total != null) r.unitPrice = round2(total / r.qty);
      return r;
    });

  function round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  const submit = async () => {
    // basic validation: ensure product + qty (and price if recordAsTxn)
    const invalid = rows.some(r =>
      !r.product || r.qty == null || (recordAsTxn && r.unitPrice == null && r.totalPrice == null)
    );
    if (invalid) {
      alert("请完善每一行：商品、数量，以及（如果记录为交易）单价或总价。");
      return;
    }

    // payload shape you can adjust as needed
    const payload = rows.map(r => ({
      product: r.product,
      qty: r.qty!,
      unit_price: recordAsTxn ? r.unitPrice : null,
      total_price: recordAsTxn ? r.totalPrice : null,
      record_as_transaction: recordAsTxn,
    }));

    try {
      await invoke("add_stock_batch", { items: payload });
      // clear on success
      setRows([{ id: uid(), product: "", qty: null, unitPrice: null, totalPrice: null }]);
      alert("入库成功！");
    } catch (e: any) {
      alert(e?.toString?.() ?? "提交失败");
    }
  };

  return (
    <div className="product-pane">
      <div className="product-table-container">
        {/* Header bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={recordAsTxn}
              onChange={(e) => setRecordAsTxn(e.target.checked)}
            />
            记录为交易
          </label>
          <button className="add-btn" onClick={addRow}>添加一行</button>
        </div>

        <table className="product-table">
          <thead>
            <tr>
              <th style={{ width: 380 }}>产品</th>
              <th style={{ width: 110 }}>数量</th>
              {recordAsTxn && <th style={{ width: 140 }}>单价</th>}
              {recordAsTxn && <th style={{ width: 160 }}>总价</th>}
              <th style={{ width: 80 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const suggestions = getSuggestions(r.product);
              return (
                <tr key={r.id} className="product-row">
                  {/* Selectize input */}
                  <td>
                    <div className="selectize">
                      <input
                        value={r.product}
                        onFocus={() => setSearchFocusId(r.id)}
                        onBlur={() => setTimeout(() => setSearchFocusId(prev => (prev === r.id ? null : prev)), 150)}
                        onChange={(e) => setRow(r.id, row => (row.product = e.target.value, row))}
                        placeholder="选择或搜索产品…"
                      />
                      {searchFocusId === r.id && suggestions.length > 0 && (
                        <div className="selectize-menu">
                          {suggestions.map((name) => (
                            <div
                              key={name}
                              className="selectize-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setRow(r.id, row => (row.product = name, row))}
                            >
                              {name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Quantity */}
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={r.qty ?? ""}
                      onChange={(e) => onQtyChange(r.id, parseNum(e.target.value))}
                    />
                  </td>

                  {/* Prices (conditionally shown) */}
                  {recordAsTxn && (
                    <>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={r.unitPrice ?? ""}
                          onChange={(e) => onUnitChange(r.id, parseNum(e.target.value))}
                          placeholder="—"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={r.totalPrice ?? ""}
                          onChange={(e) => onTotalChange(r.id, parseNum(e.target.value))}
                          placeholder="—"
                        />
                      </td>
                    </>
                  )}

                  {/* Actions */}
                  <td>
                    <button className="action-btn delete" onClick={() => removeRow(r.id)} disabled={rows.length === 1}>
                      删除
                    </button>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={recordAsTxn ? 5 : 3} style={{ padding: 16, opacity: 0.6 }}>
                  暂无条目
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="footer-bar">
        <button className="add-btn" onClick={submit}>提交入库</button>
      </div>
    </div>
  );
}
