import { useEffect, useMemo, useState } from "react";
import Select, { createFilter } from "react-select";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from 'uuid';

import type { Product } from "../../types/product";

import './AddStockPane.css'

type Row = {
  id: string;
  product: string;          // product name
  qty: number | null;
  expiry: string | null;     // YYYY-MM-DD or null
  // unitPrice: number | null; // per-unit price
  // totalPrice: number | null;
};

// safe numeric parser: "" -> null, valid -> number
function parseNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function AddStockPane() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Row[]>([
    { id: uuidv4(), product: "", qty: null, expiry: null } //, unitPrice: null, totalPrice: null },
  ]);

  useEffect(() => {
    (async () => {
      const list = await invoke<Product[]>("get_all_products");
      setProducts(
        [...list].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })
        )
      );
    })();
  }, []);

  // react-select options
  const productOptions = useMemo(
    () => products.map(p => ({ value: p.name, label: p.name })),
    [products]
  );

  const setRow = (id: string, updater: (r: Row) => Row) => {
    setRows(rs => rs.map(r => (r.id === id ? updater({ ...r }) : r)));
  };

  const addRow = () =>
    setRows(rs => [...rs, { id: uuidv4(), product: "", qty: null, expiry: null}]);//, unitPrice: null, totalPrice: null }]);

  const removeRow = (id: string) =>
    setRows(rs => (rs.length === 1 ? rs : rs.filter(r => r.id !== id)));

  // price syncing
  const onQtyChange = (id: string, qty: number | null) =>
    setRow(id, r => {
      r.qty = qty;
      return r;
    });

  const onExpiryChange = (id: string, v: string) =>
    setRow(id, r => { r.expiry = v === "" ? null : v; return r; });    

  // const onQtyChange = (id: string, qty: number | null) =>
  //   setRow(id, r => {
  //     r.qty = qty;

  //     if (qty == null || qty === 0) {
  //       // if qty is empty or 0, we can’t meaningfully calculate prices
  //       // so just clear both unit & total
  //       r.unitPrice = null;
  //       r.totalPrice = null;
  //     } else if (r.unitPrice != null) {
  //       // recalc total when qty + unit price exist
  //       r.totalPrice = round2(qty * r.unitPrice);
  //     } else if (r.totalPrice != null) {
  //       // recalc unit when qty + total price exist
  //       r.unitPrice = round2(r.totalPrice / qty);
  //     }

  //     return r;
  //   });

  // const onUnitChange = (id: string, unit: number | null) =>
  //   setRow(id, r => {
  //     r.unitPrice = unit;

  //     if (unit == null) {
  //       // if unit price cleared, also clear total
  //       r.totalPrice = null;
  //     } else if (r.qty && r.qty !== 0) {
  //       // recalc total when possible (keep your current 0 behavior)
  //       r.totalPrice = round2(r.qty * unit);
  //     }
  //     return r;
  //   });

  // const onTotalChange = (id: string, total: number | null) =>
  //   setRow(id, r => {
  //     r.totalPrice = total;

  //     if (total == null) {
  //       // if total cleared, also clear unit price
  //       r.unitPrice = null;
  //     } else if (r.qty && r.qty !== 0) {
  //       // recalc unit when possible (avoid divide-by-zero)
  //       r.unitPrice = round2(total / r.qty);
  //     }
  //     return r;
  //   });

  // function round2(n: number) {
  //   return Math.round(n * 100) / 100;
  // }

  const submit = async () => {
    const invalid = rows.some(
      r => !r.product || r.qty == null || !r.expiry
    );
    if (invalid) {
      alert("请完善每一行：产品、数量、有效期。");
      return;
    }

    const payload = rows.map(r => ({
      name: r.product,
      expiry_date: r.expiry!,
      qty: r.qty!,
    }));

    try {
      await invoke("add_stock", { changes: payload });
      setRows([{ id: uuidv4(), product: "", qty: null, expiry: null }]); //, unitPrice: null, totalPrice: null }]);
      alert("入库成功！");
    } catch (e: any) {
      alert(e?.toString?.() ?? "提交失败");
    }
  };

  // react-select dark theme styles using your CSS variables
  const selectStyles = {
    control: (base: any) => ({
      ...base,
      minHeight: 36,
      backgroundColor: "var(--bg-highlight)",
      color: "var(--text)",
      borderColor: "var(--border)",
      boxShadow: "none",
      ":hover": { borderColor: "var(--button-hover)" },
    }),
    singleValue: (base: any) => ({ ...base, color: "var(--text)" }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: "var(--bg-highlight)",
      border: `1px solid var(--border)`,
      borderRadius: 8,
      overflow: "hidden",
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isFocused ? "var(--row-hover)" : "var(--bg-highlight)",
      color: "var(--text)",
      cursor: "pointer",
    }),
    input: (base: any) => ({ ...base, color: "var(--text)" }),
    placeholder: (base: any) => ({ ...base, color: "var(--text)", opacity: 0.6 }),
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
  };

  return (
    <div className="product-pane">
      <div className="product-table-container">
        {/* Header bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
          {/* <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={recordAsTxn}
              onChange={(e) => setRecordAsTxn(e.target.checked)}
            />
            记录为交易
          </label> */}
          <button className="add-btn" onClick={addRow}>添加一行</button>
        </div>

        <table className="product-table">
          <thead>
            <tr>
              <th style={{ width: 380 }}>产品</th>
              <th style={{ width: 140 }}>有效期</th>
              <th style={{ width: 110 }}>数量</th>
              {/* {recordAsTxn && <th style={{ width: 140 }}>单价</th>}
              {recordAsTxn && <th style={{ width: 160 }}>总价</th>} */}
              <th style={{ width: 80 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="product-row">
                {/* Product select (React Select) */}
                <td>
                  <Select
                    classNamePrefix="rs"
                    options={productOptions}
                    value={productOptions.find(o => o.value === r.product) || null}
                    onChange={(opt) =>
                      setRow(r.id, row => (row.product = (opt ? (opt as any).value : ""), row))
                    }
                    isClearable
                    isSearchable
                    placeholder="选择或搜索产品..."
                    // portal to body so the menu isn't clipped by the scroll container
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                    styles={selectStyles as any}
                    // nicer filtering (case-insensitive, diacritics)
                    filterOption={createFilter({ ignoreCase: true, ignoreAccents: true, trim: true })}
                  />
                </td>

                {/* Expiry date */}
                <td>
                  <input
                    type="date"
                    value={r.expiry ?? ""}
                    onChange={(e) => onExpiryChange(r.id, e.target.value)}
                  />
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
                {/* {recordAsTxn && (
                  <>
                    <td>
                      <input
                        type="number"
                        step="1"
                        min={0}
                        value={r.unitPrice ?? ""}
                        onChange={(e) => onUnitChange(r.id, parseNum(e.target.value))}
                        placeholder="—"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="10"
                        min={0}
                        value={r.totalPrice ?? ""}
                        onChange={(e) => onTotalChange(r.id, parseNum(e.target.value))}
                        placeholder="—"
                      />
                    </td>
                  </>
                )} */}

                {/* Actions */}
                <td>
                  <button
                    className="action-btn delete"
                    onClick={() => removeRow(r.id)}
                    disabled={rows.length === 1}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: 16, opacity: 0.6 }}>
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