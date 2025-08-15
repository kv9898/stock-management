import { useState, useEffect } from "react";

import { Product } from "./productManagementPane";

import "./productFormModal.css";

type ProductFormProps = {
  mode: "add" | "edit";
  product?: string;
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
  const [shelfLifeDays, setshelfLifeDays] = useState(0);

  useEffect(() => {
    if (mode === "edit" && product) {
      setName(product);
      setshelfLifeDays(0);
    } else {
      setName("");
      setshelfLifeDays(0);
    }
  }, [mode, product]);

  const handleSubmit = () => {
    if (!name) return;
    onSubmit({ name, shelf_life_days: shelfLifeDays, picture: null });
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
          value={shelfLifeDays}
          onChange={(e) => setshelfLifeDays(parseInt(e.target.value))}
        />
        <button onClick={handleSubmit}>
          {mode === "edit" ? "保存更改" : "添加产品"}
        </button>
        <button onClick={onClose}>取消</button>
      </div>
    </div>
  );
}
