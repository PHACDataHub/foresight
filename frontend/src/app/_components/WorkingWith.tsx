"use client";

import { useMemo } from "react";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useStore } from "~/app/_store";
import { useSearchTerms } from "~/app/_hooks/useSearchTerms";

export default function WorkingWith() {
  const { articleCount, searchMatches } = useStore();
  const t = useTranslations();
  const terms = useSearchTerms();

  const articleMsg = useMemo(() => {
    if (articleCount === 0) return <></>;
    return (
      <Typography variant="body1" fontSize={16}>
        {t.rich("articles", {
          strong: (c) => <strong>{c}</strong>,
          count: articleCount,
        })}
      </Typography>
    );
  }, [articleCount, t]);

  const highlightMsg = useMemo(() => {
    if (terms.length === 0) return <></>;
    return (
      <Typography variant="body1" fontSize={16}>
        {t.rich("items", {
          strong: (c) => <strong>{c}</strong>,
          count: searchMatches.length,
        })}
      </Typography>
    );
  }, [searchMatches.length, t, terms.length]);

  return (
    <>
      {articleMsg}
      {highlightMsg}
    </>
  );
}
