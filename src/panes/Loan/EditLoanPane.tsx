// src/panes/Loan/EditLoanPane.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import type { Product } from "../../types/product";
import type { Direction, LoanHeader, LoanItem } from "../../types/loan";

import LineItemsTable from "../../components/LineItems/LineItemsTable";
import { LineItem, useLineItems } from "../../components/LineItems/hook";

interface EditLoanPaneProps {
  loan: LoanHeader | null;
  refreshSignal?: number;
  onClose: () => void;
  onSave: () => void;
}

export default function EditLoanPane({
  loan,
  refreshSignal = 0,
  onClose,
  onSave,
}: EditLoanPaneProps) {
  const [products, setProducts] = useState<Product[]>([]);

  // Form fields (editable)
  const [counterparty, setCounterparty] = useState("");
  const [direction, setDirection] = useState<Direction>("loan_out");
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

  const fetchLoanItems = async () => {
    if (!loan) return;

    try {
      const loanItems = await invoke<LoanItem[]>("get_loan_items", {
        loanId: loan.id,
      });

      const rowsData: LineItem[] = loanItems.map((item) => ({
        id: item.id,
        product: item.product_name,
        qty: item.quantity,
        expiry: item.expiry || null,
      }));
      console.log("Fetched loan items:", rowsData);
      // Set the initial rows for the hook
      setAllRows(rowsData);
    } catch (err) {
      console.error("Error fetching loan details:", err);
    }
  };

  // Load loan data when component mounts or loan changes
  useEffect(() => {
    if (loan) {
      setCounterparty(loan.counterparty);
      setDirection(loan.direction as Direction);
      setTxnDate(loan.date);
      setNote(loan.note || "");
      fetchProducts();
      fetchLoanItems();
    }
  }, [loan]);

  useEffect(() => {
    fetchProducts().catch((e) => console.error(e));
  }, [refreshSignal, fetchProducts]);

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.name, label: p.name })),
    [products]
  );

  // Conditional validator: require expiry only when adjustStock is true
  function isRowCompleteForLoan(r: {
    product: string;
    qty: number | null;
    expiry: string | null;
  }) {
    return !!(r.product && r.qty != null);
  }

  const submit = async () => {
    const itemsToSave = nonGhostRows;

    if (!counterparty.trim()) return alert("请填写往来单位。");
    if (!txnDate) return alert("请选择交易日期。");
    if (itemsToSave.length === 0) return alert("请至少填写一条记录。");
    if (itemsToSave.some((r) => !isRowCompleteForLoan(r))) {
      return alert("存在未填写完整的行（产品、数量必填）。");
    }

    try {
      // Build payload for update
      const itemsPayload: LoanItem[] = itemsToSave.map((r) => ({
        id: r.id || uuidv4(),
        product_name: r.product,
        quantity: r.qty!,
      }));

      const headerPayload: LoanHeader = {
        id: loan!.id,
        date: txnDate,
        direction,
        counterparty: counterparty.trim(),
        note: note.trim() || null,
      };

      await invoke("update_loan", {header: headerPayload, items: itemsPayload});
      onSave();
      onClose();
      alert("更新成功！");
    } catch (e: any) {
      console.error(e);
      alert(e?.toString?.() ?? "更新失败");
    }
  };

  if (!loan) return null;

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
        <h2 style={{ margin: 0 }}>编辑借贷记录</h2>
        <span style={{ opacity: 0.7 }}>
          {loan.date} - {loan.counterparty}
        </span>
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
          showExpiry={false}
        />
      </div>

      {/* Footer form (same as AddLoanPane) */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <label style={{ whiteSpace: "nowrap" }}>对方姓名</label>
          <input
            type="text"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="例如：徐丽"
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label>方向</label>
          <select
            value={direction}
            style={{ width: 80 }}
            onChange={(e) => setDirection(e.target.value as Direction)}
          >
            <option value="loan_out">借出</option>
            <option value="loan_in">借入</option>
            <option value="return_in">还入</option>
            <option value="return_out">还出</option>
          </select>
        </div>

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
