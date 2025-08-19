// ProductSelect.tsx
import Select, { createFilter } from "react-select";
import "./ProductSelect.css"

type Opt = { value: string; label: string };

export default function ProductSelect({
  options,
  value,
  onChange,
  inputRef,
}: {
  options: Opt[];
  value: string;
  onChange: (name: string) => void;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const styles = {
    control: (base: any) => ({
      ...base,
      minHeight: 36,
      backgroundColor: "var(--bg-highlight)",
      color: "var(--text)",
      borderColor: "var(--border)",
      boxShadow: "none",
      ":hover": { borderColor: "var(--button-hover)" },
    }),
    singleValue: (base: any) => ({ ...base, color: "var(--text)" }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: "var(--bg-highlight)",
      border: `1px solid var(--border)`,
      borderRadius: 8,
      overflow: "hidden",
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isFocused ? "var(--row-hover)" : "var(--bg-highlight)",
      color: "var(--text)",
      cursor: "pointer",
    }),
    input: (base: any) => ({ ...base, color: "var(--text)" }),
    placeholder: (base: any) => ({ ...base, color: "var(--text)", opacity: 0.6 }),
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
  };

  const opts = options;
  const selected = opts.find(o => o.value === value) || null;

  return (
    <Select
      classNamePrefix="rs"
      options={opts}
      value={selected}
      onChange={(opt) => onChange(opt ? (opt as any).value : "")}
      isClearable
      isSearchable
      placeholder="选择或搜索产品..."
      menuPortalTarget={document.body}
      menuPosition="fixed"
      styles={styles as any}
      filterOption={createFilter({ ignoreCase: true, ignoreAccents: true, trim: true })}
      ref={(el) => {
        if (inputRef) inputRef(el ? (el as any).inputRef : null);
      }}
    />
  );
}
