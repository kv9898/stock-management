import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ProductFormModal from "./productFormModal";

import "./productManagementPane.css";

type Product = {
  name: string;
  shelf_life_days: number;
};

export default function ProductManagementPane() {
  const [products, setProducts] = useState<Product[]>([]);
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
    const confirm = window.confirm("Are you sure? This will be permanent.");
    if (!confirm) return;

    const canDelete = await invoke("can_delete_product", { name });
    if (!canDelete) {
      alert("Product is used in stock or transactions.");
      return;
    }

    await invoke("delete_product", { name });
    fetchProducts();
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
                  <button className="action-btn" onClick={() => openEditModal(p)}>
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
