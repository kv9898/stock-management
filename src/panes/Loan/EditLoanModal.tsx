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
} from "@mui/material";
import type { LoanHeader, LoanItem } from "../../types/loan";
import type { Product } from "../../types/product";

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
      const loanItems = await invoke<LoanItem[]>("get_loan_items", { loanId: loan?.id});
      const productList = await invoke<Product[]>("get_all_products");
      setItems(loanItems);
      setProducts(productList);
    } catch (err) {
      console.error("Error fetching loan details:", err);
    } finally {
      setLoading(false);
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>编辑借贷记录</DialogTitle>
      <DialogContent>
        {loading ? (
          <Typography>加载中...</Typography>
        ) : (
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              编辑功能开发中...
            </Typography>
            {/* TODO: Implement edit form similar to AddLoanPane */}
            {/* This would include:
                 - Date picker
                 - Counterparty input
                 - Direction selector
                 - Line items table with product, quantity, expiry
                 - Adjust stock checkbox
            */}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained">
          {saving ? "保存中..." : "保存"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
