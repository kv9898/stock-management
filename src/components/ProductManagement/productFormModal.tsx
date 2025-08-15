import { useState, useEffect } from "react";
import "./productFormModal.css";

type Product = {
  name: string;
  expiry_days: number;
};

type ProductFormProps = {
  mode: "add" | "edit";
  product?: Product;
  onSubmit: (data: Product) => void;
  onClose: () => void;
};

export default function ProductFormModal({
  mode,
  product,
  onSubmit,
  onClose,
}: ProductFormProps) {
  const [name, setName] = useState("");
  const [expiryDays, setExpiryDays] = useState(0);

  useEffect(() => {
    if (mode === "edit" && product) {
      setName(product.name);
      setExpiryDays(product.expiry_days);
    } else {
      setName("");
      setExpiryDays(0);
    }
  }, [mode, product]);

  const handleSubmit = () => {
    if (!name) return;
    onSubmit({ name, expiry_days: expiryDays });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{mode === "edit" ? "编辑产品" : "添加产品"}</h3>
        <input
          placeholder="名称"
          value={name}
          disabled={mode === "edit"} // only disable for editing
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          placeholder="有效期（天）"
          value={expiryDays}
          onChange={(e) => setExpiryDays(parseInt(e.target.value))}
        />
        <button onClick={handleSubmit}>
          {mode === "edit" ? "保存更改" : "添加产品"}
        </button>
        <button onClick={onClose}>取消</button>
      </div>
    </div>
  );
}
