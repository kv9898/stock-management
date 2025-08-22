import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Box,
  Chip,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

interface Transaction {
  id: string;
  date: string;
  direction: string;
  quantity: number;
  note: string | null;
}

interface TransactionDetailsModalProps {
  open: boolean;
  counterparty: string;
  productName: string;
  onClose: () => void;
  onEditTransaction: (loanId: string) => void;
}

export default function TransactionDetailsModal({
  open,
  counterparty,
  productName,
  onClose,
  onEditTransaction,
}: TransactionDetailsModalProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTransactions();
    }
  }, [open, counterparty, productName]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const data = await invoke<Transaction[]>("get_transaction_details", {
        counterparty,
        productName,
      });
      setTransactions(data);
    } catch (err) {
      console.error("Error fetching transaction details:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDirectionLabel = (direction: string) => {
    switch (direction) {
      case "loan_out": return "借出";
      case "loan_in": return "借入";
      case "return_in": return "还入";
      case "return_out": return "还出";
      default: return direction;
    }
  };

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case "loan_out": return "warning";
      case "loan_in": return "success";
      case "return_in": return "info";
      case "return_out": return "error";
      default: return "default";
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
      field: "direction",
      headerName: "方向",
      width: 100,
      renderCell: (params) => (
        <Chip
          label={getDirectionLabel(params.value)}
          color={getDirectionColor(params.value) as any}
          size="small"
        />
      ),
    },
    {
      field: "quantity",
      headerName: "数量",
      type: "number",
      width: 100,
    },
    {
      field: "note",
      headerName: "备注",
      flex: 1,
      minWidth: 200,
      valueGetter: (value) => value || "-",
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        交易明细 - {counterparty} - {productName}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, height: 400 }}>
          <DataGrid
            rows={transactions}
            columns={columns}
            loading={loading}
            disableColumnMenu
            autoPageSize
            onRowClick={(params) => onEditTransaction(params.row.id)}
            sx={{
              height: "100%",
              "& .MuiDataGrid-row:hover": { cursor: "pointer" },
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}