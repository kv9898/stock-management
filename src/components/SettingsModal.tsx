import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

type Config = {
  url: string;
  token: string;
  alert_period: number; // u16 on Rust side
};

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const [form, setForm] = useState<Config>({ url: "", token: "", alert_period: 10 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load config when opened
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    invoke<Config>("get_config")
      .then((cfg) => setForm(cfg))
      .catch((e) => setError(typeof e === "string" ? e : (e?.message ?? "获取设置失败")))
      .finally(() => setLoading(false));
  }, [open]);

  const onChange =
    (key: keyof Config) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (key === "alert_period") {
        const n = clamp(Number(val || 0), 0, 731);
        setForm((f) => ({ ...f, alert_period: n }));
      } else {
        setForm((f) => ({ ...f, [key]: val }));
      }
    };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // simple validation
    if (!form.url.trim()) {
      setSaving(false);
      setError("URL 不能为空");
      return;
    }
    if (form.alert_period < 0 || form.alert_period > 731) {
      setSaving(false);
      setError("提醒天数需要在 0 到 731 之间");
      return;
    }

    try {
      // Rust: #[tauri::command] pub fn write_config(handle: AppHandle, config: Config) -> Result<()>
      await invoke("write_config", { newCfg: form });
      onClose();
    } catch (e: any) {
      setError(typeof e === "string" ? e : (e?.message ?? "保存失败"));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onClick={onClose}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 id="settings-title">设置</h3>

        {loading ? (
          <p style={{ margin: 0, opacity: 0.7 }}>读取中…</p>
        ) : (
          <>
            {error && (
              <p style={{ color: "crimson", marginTop: 0, marginBottom: 8 }}>{error}</p>
            )}

            <label style={{ display: "grid", gap: 6 }}>
              <span>服务器地址（URL）</span>
              <input
                type="text"
                placeholder="例如：http://192.168.2.166:1420"
                value={form.url}
                onChange={onChange("url")}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>访问令牌（Token）</span>
              <input
                type="text"
                placeholder="secret token"
                value={form.token}
                onChange={onChange("token")}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>提醒周期（天）</span>
              <input
                type="number"
                min={0}
                max={731}
                value={form.alert_period}
                onChange={onChange("alert_period")}
              />
            </label>

            <div className="modal-actions">
              <button className="btn primary" onClick={handleSave} disabled={saving}>
                {saving ? "保存中…" : "保存"}
              </button>
              <button className="btn" onClick={onClose}>取消</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
