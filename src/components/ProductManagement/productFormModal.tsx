import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Product } from "./productManagementPane";
import "./productFormModal.css";

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
  const [shelfLifeDays, setShelfLifeDays] = useState(0);
  const [picture, setPicture] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
  if (mode === "edit" && product) {
    (async () => {
      const result = await invoke<Product>("get_product", {
        name: product.name,
        shelf_life_days: product.shelf_life_days,
      });
      setName(result.name);
      setShelfLifeDays(result.shelf_life_days);
      setPicture(result.picture || null);
    })();
  } else {
    setName("");
    setShelfLifeDays(0);
    setPicture(null);
  }
}, [mode, product]);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setPicture(reader.result as string); // base64 string
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (!name) return;
    onSubmit({ name, shelf_life_days: shelfLifeDays, picture });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        <h3>{mode === "edit" ? "编辑产品" : "添加产品"}</h3>

        <input
          placeholder="名称"
          value={name}
          disabled={mode === "edit"}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="number"
          placeholder="有效期（天）"
          value={shelfLifeDays}
          onChange={(e) => setShelfLifeDays(parseInt(e.target.value))}
        />

        <div className="picture-upload" ref={dropRef}>
          <p>拖拽图片到此处或选择文件</p>
          <input type="file" accept="image/*" onChange={handleFileChange} />
          {picture && (
            <img src={picture} alt="Preview" className="picture-preview" />
          )}
        </div>

        <button onClick={handleSubmit}>
          {mode === "edit" ? "保存更改" : "添加产品"}
        </button>
        <button onClick={onClose}>取消</button>
      </div>
    </div>
  );
}
