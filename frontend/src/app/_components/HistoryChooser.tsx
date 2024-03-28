"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";

import { useStore } from "~/app/_store";

export default function HistoryChooser() {
  const { history } = useStore();
  const router = useRouter();
  const { locale, day } = useParams();

  const handleChange = useCallback(
    (evt: SelectChangeEvent) => {
      const t = parseInt(evt.target.value);
      if (typeof locale === "string" && typeof day === "string") {
        if (t === 3 || t === 7 || t === 30) {
          router.push(`/${locale}/${day}/${t}`);
        } else {
          router.push(`/${locale}/${day}`);
        }
      }
    },
    [day, locale, router],
  );

  const dayNum = useMemo(
    () => (typeof day === "string" ? parseInt(day) : -1),
    [day],
  );

  return (
    <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
      <InputLabel sx={{ fontSize: 16 }} id="select-timespan">
        Time Span
      </InputLabel>
      <Select
        sx={{ fontSize: 16 }}
        labelId="select-timespan"
        value={history ? `${history}` : "1"}
        onChange={handleChange}
        label="Time Span"
      >
        <MenuItem sx={{ fontSize: 16 }} value={1}>
          Today
        </MenuItem>
        <MenuItem
          sx={{ fontSize: 16 }}
          disabled={dayNum < 33 || dayNum > 39}
          value={3}
        >
          Last 3 Days
        </MenuItem>
        <MenuItem sx={{ fontSize: 16 }} disabled={dayNum !== 37} value={7}>
          Last 7 Days
        </MenuItem>
        <MenuItem sx={{ fontSize: 16 }} disabled={dayNum !== 60} value={30}>
          Last 30 Days
        </MenuItem>
      </Select>
    </FormControl>
  );
}
