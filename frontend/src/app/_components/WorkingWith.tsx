"use client";

import Typography from "@mui/material/Typography";
import { useStore } from "~/app/_store";

export default function WorkingWith() {
  const { articleCount, searchMatches } = useStore();
  if (articleCount === 0) return;

  return (
    <Typography variant="body1" fontSize={16}>
      You are working with <b>{articleCount.toLocaleString()}</b> articles.
      {searchMatches.length > 0 && (
        <p>
          Found <b className="bg-yellow-200">{searchMatches.length.toLocaleString()}</b> relevant
          items.
        </p>
      )}
    </Typography>
  );
}
