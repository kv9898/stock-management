// ExpiryDatePicker.tsx
import { forwardRef, useImperativeHandle, useRef } from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/zh-cn";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

type Props = {
  value: string | null;                    // "YYYY-MM-DD" | null
  onChange: (s: string | null) => void;
  onEnterNext: () => void;
};

export const ExpiryDatePicker = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, onEnterNext }, ref) => {
    const dj: Dayjs | null = value ? dayjs(value, "YYYY-MM-DD") : null;

    // This will point to the actual <input> inside the TextField
    const inputRef = useRef<HTMLInputElement>(null);

    // Expose the <input> to the parent’s ref
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    return (
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="zh-cn">
        <DatePicker
          value={dj}
          format="YYYY/MM/DD"
          minDate={dayjs("1900-01-01")}
          maxDate={dayjs("2099-12-31")}
          onChange={(newVal: Dayjs | null) =>
            onChange(newVal ? newVal.format("YYYY-MM-DD") : null)
          }
          slotProps={{
            textField: {
              size: "small",
              inputRef, // <-- critical: gives you the real input element
              onKeyDown: (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onEnterNext();
                }
              },
              sx: {
                "& .MuiInputBase-root": {
                  backgroundColor: "var(--bg-highlight)",
                  color: "var(--text)",
                },
              },
            },
          }}
        />
      </LocalizationProvider>
    );
  }
);
