import { useEffect, useMemo, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from 'uuid';

import type { Product } from "../../types/product";
import { ExpiryDatePicker } from "../../components/LineItems/ExpiryDatePicker";
import ProductSelect from "../../components/LineItems/ProductSelect";

import './AddStockPane.css'

import LineItemsTable from "../../components/LineItems/LineItemsTable";
import { useLineItems, isItemComplete } from "../../components/LineItems/hook";

export default function AddStockPane() {
  const [products, setProducts] = useState<Product[]>([]);
  const { rows, setRow, removeRow, reset, inputRefs, nonGhostRows, handleEnter } = useLineItems();

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

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.name, label: p.name })),
    [products]
  );

  const submit = async () => {
    const items = nonGhostRows;
    if (items.length === 0) return alert("请至少填写一条记录。");
    if (items.some((r) => !isItemComplete(r))) {
      return alert("存在未填写完整的行（产品、数量、有效期均必填）。");
    }

    const payload = items.map((r) => ({
      name: r.product,
      expiry_date: r.expiry!,
      qty: r.qty!,
    }));

    try {
      await invoke("add_stock", { changes: payload });
      reset();
      alert("提交成功！");
    } catch (e: any) {
      alert(e?.toString?.() ?? "提交失败");
    }
  };

  return (
    <div className="product-pane">
      <LineItemsTable
        rows={rows}
        productOptions={productOptions}
        setRow={setRow}
        removeRow={removeRow}
        inputRefs={inputRefs}
        handleEnter={handleEnter}
      />

      <div className="footer-bar">
        <button className="add-btn" onClick={submit}>提交入库</button>
      </div>
    </div>
  );
}