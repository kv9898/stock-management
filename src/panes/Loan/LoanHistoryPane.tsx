import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from "@mui/material";
import type { LoanHeader, LoanItem, Direction } from "../../types/loan";
import type { Product } from "../../types/product";

interface EditLoanModalProps {
  open: boolean;
  loanId: string | null;
  onClose: () => void;
  onSave: () => void;
}

function EditLoanModal({ open, loanId, onClose, onSave }: EditLoanModalProps) {
  const [loan, setLoan] = useState<LoanHeader | null>(null);
  const [items, setItems] = useState<LoanItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && loanId) {
      fetchLoanDetails();
    }
  }, [open, loanId]);

  const fetchLoanDetails = async () => {
    setLoading(true);
    try {
      // TODO: Implement backend functions
      // const loanDetails = await invoke<LoanHeader>("get_loan_details", { loanId });
      // const loanItems = await invoke<LoanItem[]>("get_loan_items", { loanId });
      // const productList = await invoke<Product[]>("get_all_products");
      // setLoan(loanDetails);
      // setItems(loanItems);
      // setProducts(productList);
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

interface LoanHistoryPaneProps {
  refreshSignal?: number;
  onDidSubmit?: () => void;
}

export default function LoanHistoryPane({
  refreshSignal,
  onDidSubmit,
}: LoanHistoryPaneProps) {
  const [loans, setLoans] = useState<LoanHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);

  const fetchLoanHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<LoanHeader[]>("get_loan_history");
      setLoans(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch loan history"
      );
      console.error("Error fetching loan history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoanHistory();
  }, [refreshSignal]);

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

  const columns: GridColDef[] = [
    {
      field: "date",
      headerName: "日期",
      flex: 1,
      minWidth: 120,
    },
    {
      field: "counterparty",
      headerName: "对方姓名",
      flex: 1,
      minWidth: 150,
    },
    {
      field: "direction",
      headerName: "方向",
      width: 100,
      renderCell: (params) => (
          getDirectionLabel(params.value)
      ),
    },
    {
      field: "note",
      headerName: "备注",
      flex: 1,
      minWidth: 200,
      valueGetter: (value) => value || "-",
    },
    {
      field: "actions",
      headerName: "操作",
      width: 150,
      renderCell: (params) => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setEditingLoanId(params.row.id)}
            sx={{ minWidth: "auto", px: 1, fontSize: "0.75rem" }}
          >
            编辑
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => console.log("View details:", params.row.id)}
            sx={{ minWidth: "auto", px: 1, fontSize: "0.75rem" }}
          >
            查看
          </Button>
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="error">加载失败: {error}</Typography>
        <button onClick={fetchLoanHistory}>重试</button>
      </Box>
    );
  }

  return (
    <Box
      sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Typography variant="h5" gutterBottom>
        借贷记录
      </Typography>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          rows={loans.map((loan) => ({ ...loan }))}
          columns={columns}
          loading={loading}
          disableColumnMenu
          autoPageSize
          onRowClick={(params) => setEditingLoanId(params.row.id)}
          sx={{
            height: "100%",
            borderRadius: 1,
            bgcolor: "background.default",
            "& .MuiDataGrid-row:hover": { backgroundColor: "action.hover" },
          }}
        />
      </Box>

      <EditLoanModal
        open={!!editingLoanId}
        loanId={editingLoanId}
        onClose={() => setEditingLoanId(null)}
        onSave={() => {
          fetchLoanHistory();
          onDidSubmit?.();
        }}
      />
    </Box>
  );
}
