import { useEffect, useMemo, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from 'uuid';

import type { Product } from "../../types/product";
import { ExpiryDatePicker } from "./ExpiryDatePicker";
import ProductSelect from "./ProductSelect";

import './AddStockPane.css'

type Row = {
  id: string;
  product: string;          // product name
  qty: number | null;
  expiry: string | null;     // YYYY-MM-DD or null
  // unitPrice: number | null; // per-unit price
  // totalPrice: number | null;
};

// helpers
const makeEmptyRow = (): Row => ({ id: uuidv4(), product: "", qty: null, expiry: null });
const isRowEmpty = (r: Row) => !r.product && r.qty == null && !r.expiry;
const isRowComplete = (r: Row) => !!r.product && r.qty != null && !!r.expiry;

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

  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);

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

  // keep a trailing empty row at all times
  const ensureTrailingBlank = (list: Row[]) => {
    if (list.length === 0) return [makeEmptyRow()];
    const last = list[list.length - 1];
    return isRowEmpty(last) ? list : [...list, makeEmptyRow()];
  };

  const setRow = (id: string, updater: (r: Row) => Row) => {
    setRows((rs) => ensureTrailingBlank(rs.map((r) => (r.id === id ? updater({ ...r }) : r))));
  };

  const removeRow = (id: string) => {
    setRows((rs) => {
      const after = rs.filter((r) => r.id !== id);
      // never remove the only (blank) row; always keep one ghost at the end
      return ensureTrailingBlank(after.length === 0 ? [makeEmptyRow()] : after);
    });
  };

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
    // Treat the last row as "ghost" if it's empty
    const isGhost = (r: Row, idx: number) =>
      idx === rows.length - 1 && isRowEmpty(r);

    const nonGhostRows = rows.filter((r, idx) => !isGhost(r, idx));

    // Must have at least one real row
    if (nonGhostRows.length === 0) {
      alert("请至少填写一条记录。");
      return;
    }

    // All non-ghost rows must be complete
    const firstInvalidIdx = nonGhostRows.findIndex(r => !isRowComplete(r));
    if (firstInvalidIdx !== -1) {
      alert("存在未填写完整的行（产品、数量、有效期均必填）。");
      return;
    }

    const payload = nonGhostRows.map(r => ({
      name: r.product,
      expiry_date: r.expiry!, // safe due to isRowComplete
      qty: r.qty!,
    }));

    try {
      await invoke("add_stock", { changes: payload });
      setRows([makeEmptyRow()]); // reset to a single ghost row
      alert("提交成功！");
    } catch (e: any) {
      alert(e?.toString?.() ?? "提交失败");
    }
  };

  function handleEnter(
    e: React.KeyboardEvent<HTMLInputElement> | null,
    rowIdx: number,
    colIdx: number
  ) {
    if (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
    }

    const nextCol = colIdx + 1;
    if (inputRefs.current[rowIdx][nextCol]) {
      inputRefs.current[rowIdx][nextCol]?.focus();
    } else {
      // jump to first col of next row
      const nextRow = rowIdx + 1;
      if (!inputRefs.current[nextRow]) return;

      inputRefs.current[nextRow][0]?.focus();
    }
    
  }

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
            {rows.map((r, rowIdx) => (
              <tr key={r.id} className="product-row">
                {/* Product select (React Select) */}
                <td>
                  <ProductSelect
                    options={productOptions}
                    value={r.product}
                    onChange={(name) => {
                      setRow(r.id, row => (row.product = name, row));
                      handleEnter(null, rowIdx, 0);
                    }}
                    inputRef={(el) => {
                      inputRefs.current[rowIdx] ||= [];
                      inputRefs.current[rowIdx][0] = el;
                    }}
                  />
                </td>

                {/* Expiry date */}
                <td>
                  <ExpiryDatePicker
                    value={r.expiry ?? ""}
                    ref={(el) => {
                      inputRefs.current[rowIdx][1] = el;
                    }}
                    onChange={(v) => onExpiryChange(r.id, v ?? "")}
                    onEnterNext={(e) => handleEnter(e, rowIdx, 1)}
                    onFinish={() => handleEnter(null, rowIdx, 1)}
                  />
                </td>

                {/* Quantity */}
                <td>
                  <input
                    type="number"
                    min={0}
                    value={r.qty ?? ""}
                    onChange={(e) => onQtyChange(r.id, parseNum(e.target.value))}
                    ref={(el) => {
                      inputRefs.current[rowIdx][2] = el;
                    }}
                    onKeyDown={(e) => handleEnter(e, rowIdx, 2)}
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

          </tbody>
        </table>
      </div>

      <div className="footer-bar">
        <button className="add-btn" onClick={submit}>提交入库</button>
      </div>
    </div>
  );
}