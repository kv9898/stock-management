// RemoveStockPane.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import ProductSelect from "../../components/LineItems/ProductSelect";
import { ExpiryDatePicker } from "../../components/LineItems/ExpiryDatePicker";

type Row = {
  id: string;
  product: string;
  expiry: string | null; // YYYY-MM-DD
  qty: number | null;
  err?: string | null;
};

type StockLot = { expiry_date: string; qty: number };

const makeEmptyRow = (): Row => ({ id: uuidv4(), product: "", expiry: null, qty: null });

const isRowEmpty = (r: Row) => !r.product && !r.expiry && r.qty == null;
const isRowComplete = (r: Row) => !!r.product && !!r.expiry && r.qty != null && !r.err;

export default function RemoveStockPane() {
  const [products, setProducts] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([makeEmptyRow()]);
  const [lotsByProduct, setLotsByProduct] = useState<Record<string, StockLot[]>>({});
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);

  // fetch products that have stock
  useEffect(() => {
    (async () => {
      const list = await invoke<string[]>("get_in_stock_products");
      setProducts(list);
    })();
  }, []);

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p, label: p })),
    [products]
  );

  const ensureTrailingBlank = (list: Row[]) => {
    if (list.length === 0) return [makeEmptyRow()];
    const last = list[list.length - 1];
    return isRowEmpty(last) ? list : [...list, makeEmptyRow()];
  };

  const setRow = (id: string, upd: (r: Row) => Row) => {
    setRows((rs) => ensureTrailingBlank(rs.map((r) => (r.id === id ? upd({ ...r }) : r))));
  };

  const removeRow = (id: string) => {
    setRows((rs) => {
      const after = rs.filter((r) => r.id !== id);
      return ensureTrailingBlank(after.length === 0 ? [makeEmptyRow()] : after);
    });
  };

  // cache lots when a product first picked
  const ensureLotsLoaded = async (product: string) => {
    if (!product || lotsByProduct[product]) return;
    const lots = await invoke<StockLot[]>("get_stock_lots", { name: product });
    setLotsByProduct((m) => ({ ...m, [product]: lots }));
  };

  const availableQtyFor = (product: string, expiry: string | null) => {
    if (!product || !expiry) return 0;
    const lot = lotsByProduct[product]?.find((l) => l.expiry_date === expiry);
    return lot?.qty ?? 0;
  };

  // Enter navigation (same as yours)
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
      const nextRow = rowIdx + 1;
      if (!inputRefs.current[nextRow]) return;
      inputRefs.current[nextRow][0]?.focus();
    }
  }

  const submit = async () => {
    // ignore trailing ghost
    const nonGhost = rows.filter((r, i) => !(i === rows.length - 1 && isRowEmpty(r)));
    if (nonGhost.length === 0) {
      alert("请至少填写一条记录。");
      return;
    }
    const invalid = nonGhost.find((r) => !isRowComplete(r));
    if (invalid) {
      alert("存在未填写完整或无效的行（产品、有效期、数量）。");
      return;
    }
    // hard-check quantities (safety)
    for (const r of nonGhost) {
      const avail = availableQtyFor(r.product, r.expiry);
      if ((r.qty ?? 0) <= 0 || (r.qty ?? 0) > avail) {
        alert(`数量超出库存：${r.product} ${r.expiry}（可用 ${avail}）`);
        return;
      }
    }

    const payload = nonGhost.map((r) => ({
      name: r.product,
      expiry_date: r.expiry!,
      qty: r.qty!, // to remove
    }));

    try {
      await invoke("remove_stock", { changes: payload });
      alert("移除成功！");
      // refresh products & lots because inventory changed
      const newProducts = await invoke<string[]>("get_in_stock_products");
      setProducts(newProducts);
      setLotsByProduct({});
      setRows([makeEmptyRow()]);
    } catch (e: any) {
      alert(e?.toString?.() ?? "移除失败");
    }
  };

  return (
    <div className="product-pane">
      <div className="product-table-container">
        <table className="product-table">
          <thead>
            <tr>
              <th style={{ width: 380 }}>产品（仅在库）</th>
              <th style={{ width: 160 }}>有效期（必须在库）</th>
              <th style={{ width: 160 }}>数量（≤库存）</th>
              <th style={{ width: 80 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, rowIdx) => {
              const lots = r.product ? lotsByProduct[r.product] ?? [] : [];
              const expiryValid =
                r.expiry ? lots.some((l) => l.expiry_date === r.expiry) : !r.expiry;
              const avail = availableQtyFor(r.product, r.expiry);

              return (
                <tr key={r.id} className="product-row">
                  {/* Product */}
                  <td>
                    <ProductSelect
                      options={productOptions}
                      value={r.product}
                      onChange={async (name) => {
                        await ensureLotsLoaded(name);
                        setRow(r.id, (row) => {
                          row.product = name;
                          // if current expiry isn’t valid for new product, clear it
                          if (row.expiry && !lotsByProduct[name]?.some(l => l.expiry_date === row.expiry)) {
                            row.expiry = null;
                          }
                          row.err = null;
                          return row;
                        });
                        handleEnter(null, rowIdx, 0);
                      }}
                      inputRef={(el) => {
                        inputRefs.current[rowIdx] ||= [];
                        inputRefs.current[rowIdx][0] = el;
                      }}
                    />
                  </td>

                  {/* Expiry (must exist in stock) */}
                  <td>
                    <ExpiryDatePicker
                      value={r.expiry ?? ""}
                      ref={(el) => {
                        inputRefs.current[rowIdx][1] = el;
                      }}
                      onChange={(v) => {
                        const val = v ?? null;
                        setRow(r.id, (row) => {
                          row.expiry = val;
                          const ok = val
                            ? (lotsByProduct[row.product] ?? []).some((l) => l.expiry_date === val)
                            : false;
                          row.err = ok ? null : (val ? "该日期无库存" : "请选择日期");
                          // if qty > avail, clamp
                          const availNow = ok ? availableQtyFor(row.product, val) : 0;
                          if (row.qty != null && row.qty > availNow) row.qty = availNow || null;
                          return row;
                        });
                      }}
                      onEnterNext={(e) => handleEnter(e ?? null, rowIdx, 1)}
                      onFinish={() => handleEnter(null, rowIdx, 1)}
                    />
                    {/* simple helper text */}
                    {!expiryValid && r.expiry && (
                      <div style={{ fontSize: 12, color: "var(--danger, #f44)" }}>该日期无库存</div>
                    )}
                  </td>

                  {/* Quantity (max = available) */}
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={avail || undefined}
                      value={r.qty ?? ""}
                      placeholder={avail ? `可用 ${avail}` : "—"}
                      onChange={(e) => {
                        const n = e.target.value.trim() === "" ? null : Number(e.target.value);
                        setRow(r.id, (row) => {
                          if (n == null) {
                            row.qty = null;
                          } else if (!Number.isFinite(n) || n < 0) {
                            row.qty = null;
                          } else {
                            row.qty = avail ? Math.min(n, avail) : null;
                          }
                          return row;
                        });
                      }}
                      ref={(el) => {
                        inputRefs.current[rowIdx][2] = el;
                      }}
                      onKeyDown={(e) => handleEnter(e, rowIdx, 2)}
                    />
                    {r.expiry && (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {avail ? `可用：${avail}` : "该日期无库存"}
                      </div>
                    )}
                  </td>

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
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="footer-bar">
        <button className="add-btn" onClick={submit}>提交出库</button>
      </div>
    </div>
  );
}
