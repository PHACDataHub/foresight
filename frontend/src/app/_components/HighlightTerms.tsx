"use client";

import React, {
  type ChangeEvent,
  type SyntheticEvent,
  useCallback,
} from "react";

import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";

import Highlighter from "react-highlight-words";

import { useDebounceCallback } from "usehooks-ts";
import Autocomplete from "@mui/material/Autocomplete";
import { useStore } from "~/app/_store";
import { useSearchTerms } from "~/app/_hooks/useSearchTerms";

export default function HighlightTerms() {
  const { searchTerms, setSearchTerms, setSearchAsYouType } = useStore();

  const updateSearchAsYouType = useDebounceCallback(setSearchAsYouType, 300);

  const handleSearchInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      updateSearchAsYouType(e.target.value);
    },
    [updateSearchAsYouType],
  );

  const handleSearchChange = useCallback(
    (event: SyntheticEvent<Element, Event>, newValue: string[]) => {
      updateSearchAsYouType("");
      setSearchTerms(newValue);
    },
    [setSearchTerms, updateSearchAsYouType],
  );

  return (
    <Autocomplete
      className="min-w-[300px] max-w-[500px]"
      sx={{ fontSize: 16 }}
      freeSolo
      fullWidth
      options={[]}
      value={searchTerms}
      onChange={handleSearchChange}
      multiple
      renderTags={(value, props) =>
        value.map((option, index) => (
          <Chip
            sx={{ fontSize: 13, padding: "3px 4px 3px 4px" }}
            label={option}
            {...props({ index })}
            key={`chip-${index}`}
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          variant="outlined"
          label="Highlight terms"
          placeholder="Search terms"
          onChange={handleSearchInputChange}
          {...params}
          InputLabelProps={{ sx: { fontSize: 16 } }}
          InputProps={{
            ...params.InputProps,
            sx: { fontSize: 16 },
          }}
        />
      )}
    />
  );
}

export function HighlightSearchTerms({ text }: { text: string }) {
  const terms = useSearchTerms();
  return <Highlighter searchWords={terms} textToHighlight={text} />;
}
