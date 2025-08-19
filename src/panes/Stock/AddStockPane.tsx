import { useEffect, useMemo, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { Product } from "../../types/product";

import LineItemsTable from "../../components/LineItems/LineItemsTable";
import { useLineItems, isItemComplete } from "../../components/LineItems/hook";

export default function AddStockPane({
  refreshSignal = 0,
  onDidSubmit,
}: {
  refreshSignal?: number;
  onDidSubmit?: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const {
    rows,
    setRow,
    removeRow,
    reset,
    inputRefs,
    nonGhostRows,
    handleEnter,
  } = useLineItems();

  // fetchers ----------------------------------------------------------
  const fetchProducts = useCallback(async () => {
    const list = await invoke<Product[]>("get_all_products");
    setProducts(
      [...list].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
          numeric: true,
        })
      )
    );
  }, []);

  // initial + on refreshSignal
  useEffect(() => {
    fetchProducts().catch((e) => alert(String(e)));
  }, [fetchProducts]);

  useEffect(() => {
    fetchProducts().catch((e) => alert(String(e)));
  }, [refreshSignal, fetchProducts]);

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.name, label: p.name })),
    [products]
  );

  // submit ------------------------------------------------------------
  const submit = async () => {
    const items = nonGhostRows;
    if (items.length === 0) return alert("请至少填写一条记录。");
    if (items.some((r) => !isItemComplete(r))) {
      return alert("存在未填写完整的行（产品、数量、有效期均必填）。");
    }

    const payload = items.map((r) => ({
      name: r.product,
      expiry_date: r.expiry!, // validated above
      qty: r.qty!,
    }));

    try {
      await invoke("add_stock", { changes: payload });
      reset();
      onDidSubmit?.(); // notify parent so it can trigger viewStock refresh
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
        <button className="add-btn" onClick={submit}>
          提交入库
        </button>
      </div>
    </div>
  );
}
