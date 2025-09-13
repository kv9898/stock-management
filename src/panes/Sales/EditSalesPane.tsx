// src/panes/Loan/EditLoanPane.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import type { Product } from "../../types/product";
import type { SalesHeader, SalesItem } from "../../types/sale";

import LineItemsTable from "../../components/LineItems/LineItemsTable";
import { LineItem, useLineItems } from "../../components/LineItems/hook";

interface EditSalesPaneProps {
  sale: SalesHeader | null;
  refreshSignal?: number;
  onClose: () => void;
  onSave: () => void;
}

export default function EditSalesPane({
  sale,
  refreshSignal = 0,
  onClose,
  onSave,
}: EditSalesPaneProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [txnDate, setTxnDate] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const {
    rows,
    setAllRows,
    setRow,
    removeRow,
    inputRefs,
    nonGhostRows,
    handleEnter,
  } = useLineItems();

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

  const fetchSalesItems = async () => {
    if (!sale) return;
    try {
      const salesItems = await invoke<SalesItem[]>("get_sales_items", {
        saleId: sale.id,
      });
      const rowsData: LineItem[] = salesItems.map((item) => ({
        id: item.id,
        product: item.product_name,
        qty: item.quantity,
        expiry: item.expiry,
      }));
      setAllRows(rowsData);
    } catch (err) {
      console.error("Error fetching sales details:", err);
    }
  };

  // Load loan data when component mounts or loan changes
  useEffect(() => {
    if (sale) {
      setTxnDate(sale.date);
      setNote(sale.note || "");
      fetchProducts();
      fetchSalesItems();
    }
  }, [sale]);

  useEffect(() => {
    fetchProducts().catch((e) => console.error(e));
  }, [refreshSignal, fetchProducts]);

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.name, label: p.name })),
    [products]
  );

  function isRowCompleteForSale(r: {
    product: string;
    qty: number | null;
    expiry: string | null;
  }) {
    return !!(r.product && r.qty != null && r.expiry);
  }

  const submit = async () => {
    const itemsToSave = nonGhostRows;
    if (!txnDate) return alert("请选择销售日期。");
    if (itemsToSave.length === 0) return alert("请至少填写一条记录。");
    if (itemsToSave.some((r) => !isRowCompleteForSale(r))) {
      return alert("存在未填写完整的行（产品、数量、有效期必填）。");
    }
    try {
      const itemsPayload: SalesItem[] = itemsToSave.map((r) => ({
        id: r.id || uuidv4(),
        sale_id: sale!.id,
        product_name: r.product,
        quantity: r.qty!,
        expiry: r.expiry ?? "",
      }));
      const headerPayload: SalesHeader = {
        id: sale!.id,
        date: txnDate,
        note: note.trim(),
      };
      await invoke("update_sale", { header: headerPayload, items: itemsPayload });
      onSave();
      onClose();
      alert("更新成功！");
    } catch (e: any) {
      console.error(e);
      alert(e?.toString?.() ?? "更新失败");
    }
  };

  if (!sale) return null;

  return (
    <div
      className="product-pane"
      style={{
        padding: 16,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header with back button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <button
          onClick={onClose}
          style={{ padding: "6px 12px", borderRadius: 6 }}
        >
          ← 返回
        </button>
        <h2 style={{ margin: 0 }}>编辑销售记录</h2>
        <span style={{ opacity: 0.7 }}>{sale.date}</span>
      </div>

      {/* Line items table */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <LineItemsTable
          rows={rows}
          productOptions={productOptions}
          setRow={setRow}
          removeRow={removeRow}
          inputRefs={inputRefs}
          handleEnter={handleEnter}
          showExpiry={true}
        />
      </div>

      {/* Footer form */}
      <div
        className="footer-bar"
        style={{
          gap: 12,
          display: "flex",
          alignItems: "center",
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label>日期</label>
          <input
            type="date"
            style={{ width: 160 }}
            value={txnDate}
            onChange={(e) => setTxnDate(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <label style={{ whiteSpace: "nowrap" }}>备注</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="可选备注"
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="add-btn" onClick={submit}>
            保存修改
          </button>
        </div>
      </div>
    </div>
  );
}
