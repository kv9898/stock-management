import { useState, useEffect } from "react";
import "./productFormModal.css";

type ProductFormProps = {
  product?: { name: string; expiry_days: number };
  onSubmit: (data: { name: string; expiry_days: number }) => void;
  onClose: () => void;
};

export default function ProductFormModal({ product, onSubmit, onClose }: ProductFormProps) {
  const [name, setName] = useState("");
  const [expiryDays, setExpiryDays] = useState(0);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setExpiryDays(product.expiry_days);
    }
  }, [product]);

  const handleSubmit = () => {
    if (!name) return;
    onSubmit({ name, expiry_days: expiryDays });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{product ? "编辑产品" : "添加产品"}</h3>
        <input
          placeholder="名称"
          value={name}
          disabled={!!product} // prevent editing name during update
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          placeholder="有效期（天）"
          value={expiryDays}
          onChange={(e) => setExpiryDays(parseInt(e.target.value))}
        />
        <button onClick={handleSubmit}>{product ? "保存更改" : "添加产品"}</button>
        <button onClick={onClose}>取消</button>
      </div>
    </div>
  );
}
