import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Product = {
  name: string;
  expiry_days: number;
  picture?: string | null; // Could be URL or base64 string
};

export default function ProductManagementPane() {
  const [products, setProducts] = useState<Product[]>([]);
  const [newProduct, setNewProduct] = useState({ name: "", expiry_days: 0 });

  // Load products from DB
  const fetchProducts = async () => {
    const result = await invoke("get_all_products");
    setProducts(result as Product[]);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAdd = async () => {
    if (!newProduct.name) return;

    await invoke("add_product", { product: newProduct });
    setNewProduct({ name: "", expiry_days: 0 });
    fetchProducts();
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
    <div>
      <h2>产品管理</h2>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>名称</th>
            <th>有效期（天）</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td>{p.expiry_days}</td>
              <td>
                <button onClick={() => handleDelete(p.name)}>删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>添加产品</h3>
      <input
        placeholder="名称"
        value={newProduct.name}
        onChange={(e) =>
          setNewProduct({ ...newProduct, name: e.target.value })
        }
      />
      <input
        type="number"
        placeholder="有效期天数"
        value={newProduct.expiry_days}
        onChange={(e) =>
          setNewProduct({ ...newProduct, expiry_days: parseInt(e.target.value) })
        }
      />
      <button onClick={handleAdd}>添加</button>
    </div>
  );
}
