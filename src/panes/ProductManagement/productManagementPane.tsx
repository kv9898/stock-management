import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { filter } from "fuzzaldrin-plus";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

import ProductFormModal from "./productFormModal";
import type { Product } from "../../types/product";
import "./productManagementPane.css";

export default function ProductManagementPane() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();

  const fetchProducts = async () => {
    const result = await invoke("get_all_products");
    setProducts(result as Product[]);
  };
  useEffect(() => {
    fetchProducts();
  }, []);

  const openAddModal = () => {
    setModalMode("add");
    setSelectedProduct(undefined);
    setShowModal(true);
  };
  const openEditModal = (product: Product) => {
    setModalMode("edit");
    setSelectedProduct(product);
    setShowModal(true);
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`确认删除商品：${name} 吗？ 删除后无法恢复！`)) return;
    try {
      await invoke("delete_product", { name });
      fetchProducts();
    } catch (err: any) {
      alert(err);
    }
  };

  // Search (fuzzaldrin) + alphabetical sort
  const visibleProducts = useMemo(() => {
    const q = search.trim();
    let list = products;
    if (q) {
      const enriched = products.map((p) => ({
        product: p,
        key: `${p.name} ${p.type ?? ""}`,
      }));
      list = filter(enriched, q, { key: "key" }).map((m) => m.product);
    }
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
        numeric: true,
      })
    );
  }, [products, search]);

  // DataGrid rows/cols
  const rows = useMemo(
    () => visibleProducts.map((p) => ({ id: p.name, ...p })), // name is PK
    [visibleProducts]
  );

  const columns: GridColDef[] = [
    {
      field: "name",
      headerName: "名称",
      flex: 1,
      minWidth: 220,
      sortable: true,
      sortComparator: (a, b) =>
        String(a ?? "").localeCompare(String(b ?? ""), undefined, {
          sensitivity: "base",
          numeric: true,
        }),
    },
    {
      field: "type",
      headerName: "分类",
      width: 140,
      valueGetter: (_val, row) => row.type ?? "—",
      sortComparator: (a, b) =>
        (a ?? "—").localeCompare(b ?? "—", undefined, {
          sensitivity: "base",
          numeric: true,
        }),
    },
    {
      field: "price",
      headerName: "会员单价",
      type: "number",
      width: 110,
      valueGetter: (v) => v ?? 0,
    },
    {
      field: "picture",
      headerName: "图片",
      width: 80,
      align: "center",
      headerAlign: "center",
      sortable: false,
      renderCell: (params) => (params.value ? "√" : ""),
    },
    {
      field: "actions",
      headerName: "操作",
      width: 160,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="action-btn"
            onClick={() => openEditModal(params.row as Product)}
          >
            编辑
          </button>
          <button
            className="action-btn delete"
            onClick={() => handleDelete(params.row.name)}
          >
            删除
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="product-pane">
      {/* Search bar */}
      <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索产品名或类型…"
          onKeyDown={(e) => e.key === "Escape" && setSearch("")}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
          }}
        />
      </div>

      {/* DataGrid table */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          disableColumnMenu
          autoPageSize
          sx={{
            borderRadius: 1,
            bgcolor: "background.default",
            "& .MuiDataGrid-row:hover": { backgroundColor: "action.hover" },
          }}
          slots={{
            noRowsOverlay: () => (
              <div style={{ padding: 16, opacity: 0.6 }}>没有匹配的产品</div>
            ),
          }}
        />
      </div>

      <div className="footer-bar">
        <button className="add-btn" onClick={openAddModal}>
          新建产品
        </button>
      </div>

      {showModal && (
        <ProductFormModal
          mode={modalMode}
          product={selectedProduct}
          onClose={() => setShowModal(false)}
          onSubmit={async (data, oldName) => {
            if (modalMode === "add") {
              await invoke("add_product", { product: data });
            } else {
              const payload = {
                product: data,
                old_name: oldName ?? selectedProduct?.name,
              };
              await invoke("update_product", { args: payload });
            }
            setShowModal(false);
            fetchProducts();
          }}
        />
      )}
    </div>
  );
}
