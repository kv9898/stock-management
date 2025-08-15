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
  const [shelfLifeDays, setShelfLifeDays] = useState<number | null>(null);
  const [picture, setPicture] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
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
      setShelfLifeDays(null);
      setPicture(null);
    }
  }, [mode, product]);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setPicture(reader.result as string); // base64
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
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
      <div className="modal-content">

        <label htmlFor="product-name">产品名称</label>
        <input
          id="product-name"
          value={name}
          disabled={mode === "edit"}
          onChange={(e) => setName(e.target.value)}
        />

        <label htmlFor="shelf-life">有效期（天）</label>
        <input
          id="shelf-life"
          type="number"
          value={shelfLifeDays ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            setShelfLifeDays(value === "" ? null : parseInt(value, 10));
          }}
        />

        <div
          className={`picture-upload ${dragOver ? "drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          ref={dropRef}
        >
          {/* Show image when present; otherwise show the prompt */}
          {picture && (
            <img src={picture} alt="预览图" className="picture-preview" />
          )}
          {!picture && <p className="drop-hint">拖拽图片到此处或选择文件</p>}

          {/* File chooser stays below */}
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </div>

        <div className="modal-actions">
          <button className="btn primary" onClick={handleSubmit}>
            {mode === "edit" ? "保存更改" : "添加产品"}
          </button>
          <button className="btn" onClick={onClose}>取消</button>
        </div>
        
      </div>
    </div>
  );
}
