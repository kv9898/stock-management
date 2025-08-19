import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import type { Product } from "../../types/product";
import type { Direction } from "../../types/loan";

import LineItemsTable from "../../components/LineItems/LineItemsTable";
import { useLineItems, isItemComplete } from "../../components/LineItems/hook";

export default function AddLoanPane() {
  const [products, setProducts] = useState<Product[]>([]);
  const { rows, setRow, removeRow, reset, inputRefs, nonGhostRows, handleEnter } = useLineItems();

  // footer fields
  const [counterparty, setCounterparty] = useState("");
  const [direction, setDirection] = useState<Direction>("loan_out");
  const [txnDate, setTxnDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [adjustStock, setAdjustStock] = useState<boolean>(true);

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
    if (!counterparty.trim()) return alert("请填写往来单位（counterparty）。");
    if (!txnDate) return alert("请选择交易日期。");
    if (items.length === 0) return alert("请至少填写一条记录。");
    if (items.some((r) => !isItemComplete(r))) {
      return alert("存在未填写完整的行（产品、数量、有效期均必填）。");
    }

    const headerId = uuidv4();
    const payload = {
      header: {
        id: headerId,
        date: txnDate,
        direction,
        counterparty: counterparty.trim(),
        note: null as string | null,
      },
      items: items.map((r) => ({
        id: uuidv4(),
        product_name: r.product,
        quantity: r.qty!,
        expiry: r.expiry!,
      })),
      adjust_stock: adjustStock,
    };

    try {
      await invoke("create_loan", payload);
      reset();
      setCounterparty("");
      setDirection("loan_out");
      setTxnDate(new Date().toISOString().slice(0, 10));
      setAdjustStock(true);
      alert("提交成功！");
    } catch (e: any) {
      console.error(e);
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

      <div className="footer-bar" style={{ gap: 12, display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ whiteSpace: "nowrap" }}>对方姓名</label>
          <input
            type="text"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="例如：徐丽"
            style={{ width: 220 }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label>方向</label>
          <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
            <option value="loan_out">借出（我们出）</option>
            <option value="loan_in">借入（我们收）</option>
            <option value="return_in">归还入库（对方还给我们）</option>
            <option value="return_out">归还出库（我们还给对方）</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label>日期</label>
          <input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
          <input
            type="checkbox"
            checked={adjustStock}
            onChange={(e) => setAdjustStock(e.target.checked)}
          />
          更改库存
        </label>

        <div style={{ marginLeft: "auto" }}>
          <button className="add-btn" onClick={submit}>提交借还</button>
        </div>
      </div>
    </div>
  );
}
