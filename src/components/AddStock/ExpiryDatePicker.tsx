import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/zh-cn";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

// inside your row rendering
export function ExpiryDatePicker({
  value,                // string | null, e.g. "2024-06-25"
  ref,                  // React ref for focus management
  onChange,             // (s: string | null) => void
  onEnterNext,          // () => void  (move focus to qty field)
}: {
  value: string | null;
  ref?: React.Ref<HTMLInputElement>;
  onChange: (s: string | null) => void;
  onEnterNext: () => void;
}) {
  // Convert to Dayjs for the picker
  const dj = value ? dayjs(value, "YYYY-MM-DD") : null;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="zh-cn">
      <DatePicker
        value={dj}
        ref={ref}
        format="YYYY/MM/DD"          // display format you want
        minDate={dayjs("1900-01-01")} // clamp years (prevents 6-digit weirdness)
        maxDate={dayjs("2099-12-31")}
        onChange={(newVal: Dayjs | null) => {
          // Send YYYY-MM-DD string to backend
          onChange(newVal ? newVal.format("YYYY-MM-DD") : null);
        }}
        // Let Enter advance focus:
        slotProps={{
          textField: {
            size: "small",
            onKeyDown: (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnterNext();
              }
            },
            // Optional: use your CSS variables
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
