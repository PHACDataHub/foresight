"use client";

import { InputAdornment, TextField } from "@mui/material";

import { useDebounceCallback } from "usehooks-ts";
import { type ChangeEvent, useCallback, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { Search } from "lucide-react";
import { useStore } from "~/app/_store";
import { api } from "~/trpc/react";
import HighlightTerms from "./HighlightTerms";

export default function PrimarySearch({
  messages,
}: {
  messages: { label: string; placeholder: string; includeAll: string };
}) {
  const { persona, setSemanticMatches, semanticSearch, setSemanticSearch } =
    useStore();

  const [search, setSearch] = useState(semanticSearch);
  const [isFetching, setFetching] = useState(false);

  const apiSemanticSearch = api.post.semanticSearch.useMutation();

  const executeSearch = useCallback(
    async (search: string) => {
      setFetching(true);
      try {
        const data = await apiSemanticSearch.mutateAsync({ search });
        console.log(data);
        setSemanticSearch(search);
        setSemanticMatches(data);
      } finally {
        setFetching(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const queueSearch = useDebounceCallback(executeSearch, 850);

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const s = event.target.value;
      setSearch(s);
      if (s.length >= 3) { 
        void queueSearch(s);
      } else setSemanticMatches([]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queueSearch],
  );

  if (persona === "tom") {
    return (
      <div className="flex w-[600px]">
        <TextField
          onChange={handleSearchChange}
          fullWidth
          multiline
          variant="outlined"
          label="Semantic Search"
          value={search}
          InputLabelProps={{ sx: { fontSize: 16 } }}
          InputProps={{
            sx: { fontSize: 16 },
            startAdornment: (
              <InputAdornment position="start">
                {!isFetching && <Search size="1em" />}
                {isFetching && <FontAwesomeIcon icon={faSpinner} spin />}
              </InputAdornment>
            ),
          }}
        />
      </div>
    );
  }

  return <HighlightTerms messages={messages} />;
}
