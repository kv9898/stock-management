import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
} from "@mui/material";
import type { LoanHeader, LoanItem } from "../../types/loan";
import type { Product } from "../../types/product";
import LineItemsTable from "../../components/LineItems/LineItemsTable";

interface EditLoanModalProps {
  open: boolean;
  loan: LoanHeader | null;
  onClose: () => void;
  onSave: () => void;
}

export default function EditLoanModal({
  open,
  loan,
  onClose,
  onSave,
}: EditLoanModalProps) {
  const [items, setItems] = useState<LoanItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && loan) {
      fetchLoanItems();
    }
  }, [open, loan]);

  const fetchLoanItems = async () => {
    setLoading(true);
    try {
      // TODO: Implement backend functions
      const loanItems = await invoke<LoanItem[]>("get_loan_items", {
        loanId: loan?.id,
      });
      const productList = await invoke<Product[]>("get_all_products");
      setItems(loanItems);
      setProducts(productList);
    } catch (err) {
      console.error("Error fetching loan details:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDirectionLabel = (direction: string) => {
    switch (direction) {
      case "loan_out":
        return "借出";
      case "loan_in":
        return "借入";
      case "return_in":
        return "还入";
      case "return_out":
        return "还出";
      default:
        return direction;
    }
  };

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case "loan_out":
        return "warning";
      case "loan_in":
        return "success";
      case "return_in":
        return "info";
      case "return_out":
        return "error";
      default:
        return "default";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Implement backend update function
      // await invoke("update_loan", {
      //   loanId,
      //   updates: { /* updated fields */ }
      // });
      onSave();
      onClose();
    } catch (err) {
      console.error("Error updating loan:", err);
    } finally {
      setSaving(false);
    }
  };

  // Convert LoanItem[] to the format expected by LineItemsTable
  const tableRows = items.map((item) => ({
    id: item.id,
    product: item.product_name,
    qty: item.quantity,
    expiry: item.expiry || null,
    ghost: false,
  }));

  const productOptions = products.map((p) => ({
    value: p.name,
    label: p.name,
  }));

return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        借贷记录详情
        {loan && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {loan.date} - {loan.counterparty}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Typography>加载中...</Typography>
        ) : (
          <Box sx={{ pt: 1 }}>
            {loan && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: "flex", gap: 3, mb: 2, flexWrap: "wrap" }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      方向
                    </Typography>
                    <Chip
                      label={getDirectionLabel(loan.direction)}
                      color={getDirectionColor(loan.direction) as any}
                      size="small"
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      对方
                    </Typography>
                    <Typography>{loan.counterparty}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      日期
                    </Typography>
                    <Typography>{loan.date}</Typography>
                  </Box>
                  {loan.note && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        备注
                      </Typography>
                      <Typography>{loan.note}</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            <Typography variant="h6" gutterBottom>
              借贷明细 ({items.length} 项)
            </Typography>

            {items.length > 0 ? (
              <LineItemsTable
                rows={tableRows}
                productOptions={productOptions}
                setRow={() => {}} // Read-only for now
                removeRow={() => {}} // Read-only for now
                inputRefs={{ current: [] }}
                handleEnter={() => {}} // Read-only for now
                headers={{ product: "产品", expiry: "有效期", qty: "数量", actions: "" }}
                disableDeleteOnSingle={true}
              />
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                暂无借贷明细
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained">
          {saving ? "保存中..." : "保存修改"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}