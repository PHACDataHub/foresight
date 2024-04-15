"use client";

import Typography from "@mui/material/Typography";
import { useMemo } from "react";
import { useStore } from "~/app/_store";

export default function WorkingWith() {
  const { articleCount, searchMatches } = useStore();

  const articleMsg = useMemo(() => {
    if (articleCount === 0) return <></>;
    return (
      <Typography variant="body1" fontSize={16}>
        You are working with <b>{articleCount.toLocaleString()}</b> articles.
      </Typography>
    );
  }, [articleCount]);

  const highlightMsg = useMemo(() => {
    if (!searchMatches || searchMatches.length === 0) return <></>;
    return (
      <Typography variant="body1" fontSize={16}>
        Found <b>{searchMatches.length.toLocaleString()}</b> relevant items.
      </Typography>
    );
  }, [searchMatches]);

  return (
    <>
      {articleMsg}
      {highlightMsg}
    </>
  );
}
