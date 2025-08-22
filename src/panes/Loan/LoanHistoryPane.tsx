import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { Button, Typography, Box } from "@mui/material";
import type { LoanHeader } from "../../types/loan";
import EditLoanPane from "./EditLoanPane";

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
  const [editingLoan, setEditingLoan] = useState<LoanHeader | null>(null);

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
      renderCell: (params) => getDirectionLabel(params.value),
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
        <Button
          size="small"
          variant="outlined"
          color="error"
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering row click
            if (confirm("确定要删除这条借贷记录吗？")) {
              handleDeleteLoan(params.row.id);
            }
          }}
          sx={{ minWidth: "auto", px: 1, fontSize: "0.75rem" }}
        >
          删除
        </Button>
      ),
    },
  ];

  const handleDeleteLoan = async (loanId: string) => {
    try {
      // TODO: Implement backend delete function
      await invoke("delete_loan", { loanId });
      fetchLoanHistory(); // Refresh the list
      onDidSubmit?.(); // Notify parent to refresh other panes
    } catch (err) {
      console.error("Error deleting loan:", err);
      alert("删除失败");
    }
  };

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
      {editingLoan ? (
        <EditLoanPane
          loan={editingLoan}
          refreshSignal={refreshSignal}
          onClose={() => setEditingLoan(null)}
          onSave={() => {
            fetchLoanHistory();
            onDidSubmit?.();
          }}
        />
      ) : (
        <>
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
              onRowClick={(params) => setEditingLoan(params.row)}
              sx={{
                height: "100%",
                borderRadius: 1,
                bgcolor: "background.default",
                "& .MuiDataGrid-row:hover": {
                  backgroundColor: "action.hover",
                  cursor: "pointer",
                },
              }}
            />
          </Box>
        </>
      )}
    </Box>
  );
}
