import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { filter } from "fuzzaldrin-plus";

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
    const confirm = window.confirm(`确认删除商品：${name} 吗？ 删除后无法恢复！`);
    if (!confirm) return;
    try {
      await invoke("delete_product", { name });
      fetchProducts();
    } catch (err: any) {
      alert(err);
    }
  };

  // Filter & sort with fuzzaldrin-plus
  const visibleProducts = useMemo(() => {
    const q = search.trim();
    let list = products;

    if (q) {
      const enriched = products.map(product => ({
          product,
          key: `${product.name} ${product.type}`
      }));

      const matches = filter(enriched, q, {
        key: 'key',
      });

      list = matches.map(m => m.product);
    }

    // Always sort alphabetically by name
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })
    );
  }, [products, search]);

  return (
    <div className="product-pane">
      {/* Search bar */}
      <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索产品名或类型…"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSearch("");
            }
          }}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
        />
      </div>

      <div className="product-table-container">
        <table className="product-table">
          <thead>
            <tr>
              <th>名称</th>
              <th style={{ width: "140px" }}>分类</th>
              <th style={{ width: "100px", textAlign: "right" }}>会员单价</th>
              <th style={{ width: "50px", textAlign: "center" }}>图片</th>
              <th style={{ width: "140px" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((p) => (
              <tr key={p.name} className="product-row">
                <td className="name-cell">{p.name}</td>
                <td>{p.type}</td>
                <td style={{ textAlign: "right" }}>{p.price}</td>
                <td style={{ textAlign: "center" }}>{p.picture ? "√" : ""}</td>
                <td>
                  <button className="action-btn" onClick={() => openEditModal(p)}>
                    编辑
                  </button>
                  <button className="action-btn delete" onClick={() => handleDelete(p.name)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {visibleProducts.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 16, opacity: 0.6 }}>
                  没有匹配的产品
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
          onSubmit={async (data) => {
            if (modalMode === "add") {
              await invoke("add_product", { product: data });
            } else {
              await invoke("update_product", { product: data });
            }
            setShowModal(false);
            fetchProducts();
          }}
        />
      )}
    </div>
  );
}
