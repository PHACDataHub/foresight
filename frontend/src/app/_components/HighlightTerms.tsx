"use client";

import { type ChangeEvent, useCallback, useState } from "react";
import { useStore } from "~/app/_store";

export default function HighlightTerms() {
  const { searchTerms, setSearchTerms } = useStore();
  const [search, setSearch] = useState(searchTerms.join(","));

  const handleSearchChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setSearchTerms(
        e.target.value
          .toLowerCase()
          .split(",")
          .filter((s) => s.length > 0),
      );
    },
    [setSearchTerms],
  );

  return (
    <div className="flex flex-1">
      <input
        type="text"
        value={search}
        className="border border-black flex-1 m-3 p-2"
        onChange={handleSearchChange}
        placeholder="Highlight terms"
      />
    </div>
  );
}
