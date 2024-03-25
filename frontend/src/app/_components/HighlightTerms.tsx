"use client";

import React, { type ChangeEvent, useCallback, useState } from "react";

import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "~/app/_store";

export default function HighlightTerms() {
  const { searchTerms, setSearchTerms } = useStore();
  const [search, setSearch] = useState("");

  const handleSearchChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSearchTerms(
        searchTerms.filter((s) => s !== search).concat([e.target.value]),
      );
      setSearch(e.target.value);
    },
    [search, searchTerms, setSearchTerms],
  );

  const handleOnKeyUp = useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      if (evt.key === "Enter" && search.length > 0) {
        setSearchTerms(
          [search].concat(searchTerms.filter((s) => s !== search)),
        );
        setSearch("");
      }
    },
    [search, searchTerms, setSearchTerms],
  );

  const handleDeleteChip = useCallback(
    (evt: React.MouseEvent<SVGElement>) => {
      const term = evt.currentTarget.parentElement?.getAttribute("data-term");
      if (term) {
        setSearchTerms(searchTerms.filter((s) => s !== term));
      }
    },
    [searchTerms, setSearchTerms],
  );

  return (
    <div className="flex items-center space-x-4 p-5">
      <ul className="m-0 flex list-none flex-wrap justify-center space-x-2 p-[0.5]">
        {searchTerms
          .filter((s) => s !== search)
          .map((s) => (
            <li key={`search_${s}`}>
              <Chip label={s} data-term={s} onDelete={handleDeleteChip} />
            </li>
          ))}
      </ul>
      <TextField
        variant="outlined"
        label="Hightlight terms"
        placeholder="Search keyword"
        onChange={handleSearchChange}
        onKeyUp={handleOnKeyUp}
        value={search}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <FontAwesomeIcon icon={faSearch} />
            </InputAdornment>
          ),
        }}
      />
    </div>
  );
}
