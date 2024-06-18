"use client";

import { useMemo } from "react";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useStore } from "~/app/_store";
import { useSearchTerms } from "~/app/_hooks/useSearchTerms";
import { api } from "~/trpc/react";

export default function WorkingWith() {
  const { searchMatches, everything, threats, history, persona } = useStore();
  const t = useTranslations();
  const terms = useSearchTerms();
  const { day } = useParams();

  const { isFetching, data: articleCount } =
    api.post.hierarchicalClustersArticleCount.useQuery(
      { day: parseInt(day as string), history, everything, threats, persona },
      {
        refetchOnWindowFocus: false,
        enabled: typeof day === "string",
      },
    );

  const articleMsg = useMemo(() => {
    if (isFetching || typeof articleCount === "undefined") return <></>;
    return (
      <Typography variant="body1" fontSize={16}>
        {t.rich("articles", {
          strong: (c) => <strong>{c}</strong>,
          count: articleCount,
        })}
      </Typography>
    );
  }, [articleCount, isFetching, t]);

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
    <div>
      {articleMsg}
      {highlightMsg}
    </div>
  );
}
