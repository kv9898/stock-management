// ExpiryDatePicker.tsx
import { forwardRef, useImperativeHandle, useRef } from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/zh-cn";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

import { PickerValue } from "@mui/x-date-pickers/internals";

type Props = {
  value: string | null;                    // "YYYY-MM-DD" | null
  onChange: (s: string | null) => void;
  onEnterNext: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onFinish?: () => void;
};

export const ExpiryDatePicker = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, onEnterNext, onFinish }, ref) => {
    const dj: Dayjs | null = value ? dayjs(value, "YYYY-MM-DD") : null;

    // This will point to the actual <input> inside the TextField
    const inputRef = useRef<HTMLInputElement>(null);

    const onAccept = (value: PickerValue) => {
      const day = value?.date();
      if (day && day > 10) {
        // If the day is more than 10, we assume it's a valid date
        onFinish?.();
      }
    }

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
          onAccept={onAccept}
          slotProps={{
            textField: {
              size: "small",
              inputRef, // <-- critical: gives you the real input element
              onKeyDown: onEnterNext,
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
