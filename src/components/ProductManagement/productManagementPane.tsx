import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ProductFormModal from "./productFormModal";

import "./productManagementPane.css";

export type Product = {
  name: string;
  shelf_life_days: number;
  picture: string | null;
};

export default function ProductManagementPane() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>();

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
    setSelectedProduct(product.name);
    setShowModal(true);
  };

  const handleDelete = async (name: string) => {
    const confirm = window.confirm(
      `确认删除商品：${name} 吗？ 删除后无法恢复！`
    );
    if (!confirm) return;

    try {
      await invoke("delete_product", { name });
      fetchProducts();
    } catch (err: any) {
      alert(err);
    }
  };

  return (
    <div className="product-pane">
      <div className="product-table-container">
        <table className="product-table">
          <thead>
            <tr>
              <th>名称</th>
              <th style={{ width: "120px" }}>有效期（天）</th>
              <th style={{ width: "140px" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.name} className="product-row">
                <td className="name-cell">{p.name}</td>
                <td>{p.shelf_life_days}</td>
                <td>
                  <button
                    className="action-btn"
                    onClick={() => openEditModal(p)}
                  >
                    编辑
                  </button>
                  <button
                    className="action-btn delete"
                    onClick={() => handleDelete(p.name)}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
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
            } else if (modalMode === "edit") {
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
