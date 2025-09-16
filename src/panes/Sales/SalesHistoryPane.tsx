import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { Button, Typography, Box } from "@mui/material";
import type { SalesHeader, SalesSummary } from "../../types/sale";
import EditSalesPane from "./EditSalesPane";

interface SalesHistoryPaneProps {
  refreshSignal?: number;
  onDidSubmit?: () => void;
}

export default function SalesHistoryPane({
  refreshSignal,
  onDidSubmit,
}: SalesHistoryPaneProps) {
  const [sales, setSales] = useState<SalesSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<SalesHeader | null>(null);

  const fetchSalesHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<SalesSummary[]>("get_sales_history");
      setSales(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "未能获取销售记录"
      );
      console.error("Error fetching sales history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!refreshSignal) return; // Skip initial
    fetchSalesHistory();
  }, [refreshSignal]);

  const columns: GridColDef[] = [
    {
      field: "date",
      headerName: "日期",
      flex: 1,
      minWidth: 120,
      valueGetter: (_, row: SalesSummary) => row.header.date
    },
    {
      field: "top_products",
      headerName: "畅销商品",
      flex: 1,
      minWidth: 300,
      valueGetter: (_, row: SalesSummary) => row.top_products.join("、") || "-",
    },
    {
      field: "total_value",
      headerName: "总金额",
      type: "number",
      flex: 1,
      minWidth: 60,
    },
    {
      field: "note",
      headerName: "备注",
      flex: 1,
      minWidth: 200,
      valueGetter: (_, row: SalesSummary) => row.header.note || "-",
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
            e.stopPropagation();
            if (confirm("确定要删除这条销售记录吗？")) {
              handleDeleteSale(params.row.header.id);
            }
          }}
          sx={{ minWidth: "auto", px: 1, fontSize: "0.75rem" }}
        >
          删除
        </Button>
      ),
    },
  ];

  const handleDeleteSale = async (saleId: string) => {
    try {
      await invoke("delete_sale", { saleId });
      fetchSalesHistory();
      onDidSubmit?.();
    } catch (err) {
      console.error("Error deleting sale:", err);
      alert("删除失败");
    }
  };

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="error">加载失败: {error}</Typography>
        <button onClick={fetchSalesHistory}>重试</button>
      </Box>
    );
  }

  return (
    <Box
      sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}
    >
      {editingSale ? (
        <EditSalesPane
          sale={editingSale}
          refreshSignal={refreshSignal}
          onClose={() => setEditingSale(null)}
          onSave={() => {
            fetchSalesHistory();
            onDidSubmit?.();
            setEditingSale(null);
          }}
        />
      ) : (
        <>
          <Typography variant="h5" gutterBottom>
            销售记录
          </Typography>

          <Box sx={{ flex: 1, minHeight: 0 }}>
            <DataGrid
              rows={sales}
              columns={columns}
              getRowId={(row: SalesSummary) => row.header.id}
              loading={loading}
              disableColumnMenu
              autoPageSize
              onRowClick={(params) => setEditingSale(params.row.header)}
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
