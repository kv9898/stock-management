import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

type Product = {
  name: string;
  expiry_days: number;
  picture?: string | null;
};

export default function ProductManagementPane() {
  const [products, setProducts] = useState<Product[]>([]);

  const fetchProducts = async () => {
    const result = await invoke("get_all_products");
    setProducts(result as Product[]);
  };

  useEffect(() => {
    fetchProducts();

    // 👂 Listen for save events from the product-form window
    const unlisten = listen("product_saved", () => {
      fetchProducts();
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const openAddProductWindow = () => {
    new WebviewWindow("product_form", {
      url: "/product-form?mode=add",
    });
  };

  const openEditProductWindow = (product: Product) => {
    new WebviewWindow("product_form", {
      url: `/product-form?mode=edit&name=${encodeURIComponent(
        product.name
      )}&expiry_days=${product.expiry_days}`,
    });
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
                <button onClick={() => openEditProductWindow(p)}>编辑</button>{" "}
                <button onClick={() => handleDelete(p.name)}>删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>添加产品</h3>
      <button onClick={openAddProductWindow}>新建产品</button>
    </div>
  );
}
