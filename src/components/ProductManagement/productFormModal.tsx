import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Product } from "../../types/product";
import { toDataUrl, stripDataUrl } from "./pictureHandler"

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
  const [price, setPrice] = useState<number | null>(null);
  const [picture, setPicture] = useState<string | null>(null); // Raw base64 payload for backend
  const [pictureURL, setPictureURL] = useState<string | null>(null); // Data URL for <img src=...>
  const [location, setLocation] = useState<string | null>(null); // Not used in this modal but can be extended
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement | null>(null);

   useEffect(() => {
    if (mode === "edit" && product) {
      (async () => {
        const result = await invoke<Product>("get_product", {
          name: product.name,
          price: product.price,
        });
        setName(result.name);
        setPrice(result.price);
        setLocation(result.location);

        // result.picture is RAW base64 (per your backend) or null
        setPicture(result.picture ?? null);
        setPictureURL(toDataUrl(result.picture)); // convert for preview
      })();
    } else {
      setName("");
      setPrice(null);
      setPicture(null);
      setPictureURL(null);
      setLocation(null);
    }
  }, [mode, product]);

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string); // data URL
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFile = async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    setPictureURL(dataUrl);                 // for <img src>
    setPicture(stripDataUrl(dataUrl));      // RAW base64 for backend
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      await handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      await handleFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (!name) return;
    onSubmit({ name, price, picture, location }); // send RAW base64
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

        <label htmlFor="price">会员单价</label>
        <input
          id="price"
          type="number"
          value={price ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            setPrice(value === "" ? null : parseInt(value, 10));
          }}
        />

        <label htmlFor="location">位置</label>
        <input
          id="location"
          value={location ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            setLocation(value === "" ? null : value);
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
          {/* Preview uses data URL */}
          {pictureURL && <img src={pictureURL} alt="预览图" className="picture-preview" />}

          {/* Prompt only when no preview */}
          {!pictureURL && <p className="drop-hint">拖拽图片到此处或选择文件</p>}

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