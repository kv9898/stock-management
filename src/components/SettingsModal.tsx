import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Config } from "../types/Config";

type Props = {
  open: boolean;
  locked?: boolean;               // when true, user cannot dismiss
  errorText?: string;
  initial: Config;                // initial values to prefill
  onClose: () => void;            // only called if not locked
  onVerified: () => void;         // called after successful verify+save
};

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

const SettingsModal: React.FC<Props> = ({
  open,
  locked = false,
  errorText,
  initial,
  onClose,
  onVerified,
}) => {
  const [form, setForm] = useState<Config>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // sync fields when opened or initial changes
  useEffect(() => {
    if (open) {
      setForm(initial);
      setErr(errorText ?? null);
    }
  }, [open, initial, errorText]);

  if (!open) return null;

  const onChange =
    (key: keyof Config) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (key === "alert_period") {
        setForm((f) => ({ ...f, alert_period: clamp(Number(val || 0), 0, 731) }));
      } else {
        setForm((f) => ({ ...f, [key]: val }));
      }
    };

  const save = async () => {
    setBusy(true);
    setErr(null);

    if (!form.url.trim()) {
      setBusy(false);
      setErr("URL 不能为空");
      return;
    }

    try {
      // 1) verify credentials first
      await invoke("verify_credentials", { url: form.url, token: form.token });

      // 2) persist config (align param name with your backend: new_cfg or config)
      await invoke("write_config", { newCfg: form });

      // 3) success
      onVerified();
    } catch (e: any) {
      setErr(typeof e === "string" ? e : e?.toString?.() ?? "保存失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onClick={() => { if (!locked) onClose(); }}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div
          className="modal-header"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <h3 id="settings-title">设置</h3>
          <button
            className="icon-btn"
            aria-label="关闭"
            onClick={onClose}
            disabled={locked}
            style={{ opacity: locked ? 0.5 : 1, pointerEvents: locked ? "none" : "auto" }}
          >
            ✕
          </button>
        </div>

        {err && (
          <div style={{ color: "#b00020", fontSize: 14, marginBottom: 8 }}>
            {err}
          </div>
        )}

        <label style={{ display: "grid", gap: 6 }}>
          <span>数据库 URL</span>
          <input
            type="text"
            placeholder="libsql://example.turso.io"
            value={form.url}
            onChange={onChange("url")}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Token</span>
          <input
            type="text"
            placeholder="数据库访问令牌"
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
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? "验证并保存…" : "保存"}
          </button>
          <button className="btn" onClick={onClose} disabled={locked || busy}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
