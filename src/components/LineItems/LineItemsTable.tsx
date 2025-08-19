import * as React from "react";
import ProductSelect from "./ProductSelect";
import { ExpiryDatePicker } from "./ExpiryDatePicker";
import { LineItem, parseNum } from "./hook";

type Option = { value: string; label: string };

export type LineItemsTableProps = {
  rows: LineItem[];
  productOptions: Option[];
  setRow: (id: string, updater: (r: LineItem) => LineItem) => void;
  removeRow: (id: string) => void;
  inputRefs: React.MutableRefObject<(HTMLInputElement | null)[][]>;
  handleEnter: (e: React.KeyboardEvent<HTMLInputElement> | null, rowIdx: number, colIdx: number) => void;
  headers?: { product?: string; expiry?: string; qty?: string; actions?: string };
  disableDeleteOnSingle?: boolean;
};

export default function LineItemsTable({
  rows,
  productOptions,
  setRow,
  removeRow,
  inputRefs,
  handleEnter,
  headers = { product: "产品", expiry: "有效期", qty: "数量", actions: "操作" },
  disableDeleteOnSingle = true,
}: LineItemsTableProps) {
  return (
    <div className="product-table-container">
      <table className="product-table">
        <thead>
          <tr>
            <th style={{ width: 380 }}>{headers.product}</th>
            <th style={{ width: 140 }}>{headers.expiry}</th>
            <th style={{ width: 110 }}>{headers.qty}</th>
            <th style={{ width: 80 }}>{headers.actions}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, rowIdx) => (
            <tr key={r.id} className="product-row">
              <td>
                <ProductSelect
                  options={productOptions}
                  value={r.product}
                  onChange={(name) => {
                    setRow(r.id, (row) => ((row.product = name), row));
                    handleEnter(null, rowIdx, 0);
                  }}
                  inputRef={(el) => {
                    inputRefs.current[rowIdx] ||= [];
                    inputRefs.current[rowIdx][0] = el;
                  }}
                />
              </td>

              <td>
                <ExpiryDatePicker
                  value={r.expiry ?? ""}
                  ref={(el) => {
                    inputRefs.current[rowIdx] ||= [];
                    inputRefs.current[rowIdx][1] = el;
                  }}
                  onChange={(v) => setRow(r.id, (row) => ((row.expiry = v || null), row))}
                  onEnterNext={(e) => handleEnter(e, rowIdx, 1)}
                  onFinish={() => handleEnter(null, rowIdx, 1)}
                />
              </td>

              <td>
                <input
                  type="number"
                  min={0}
                  value={r.qty ?? ""}
                  onChange={(e) =>
                    setRow(r.id, (row) => ((row.qty = parseNum(e.target.value)), row))
                  }
                  ref={(el) => {
                    inputRefs.current[rowIdx] ||= [];
                    inputRefs.current[rowIdx][2] = el;
                  }}
                  onKeyDown={(e) => handleEnter(e, rowIdx, 2)}
                />
              </td>

              <td>
                <button
                  className="action-btn delete"
                  onClick={() => removeRow(r.id)}
                  disabled={disableDeleteOnSingle && rows.length === 1}
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
