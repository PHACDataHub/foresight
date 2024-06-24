import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import { useSearchTerms } from "~/app/_hooks/useSearchTerms";

export default function ClusterKeywordGroup({
  title,
  keywords,
  color,
  variant,
}: {
  title: string;
  keywords: string[];
  color?:
    | "default"
    | "info"
    | "error"
    | "primary"
    | "secondary"
    | "success"
    | "warning";
  variant?: "filled" | "outlined";
}) {
  const [max, setMax] = useState(9);
  const terms = useSearchTerms();

  useEffect(() => {
    setMax(9);
  }, [keywords]);

  const kw = useMemo(() => {
    return keywords.sort(
      (a, b) => (terms.includes(a) ? 0 : 1) - (terms.includes(b) ? 0 : 1),
    );
  }, [terms, keywords]);

  const match = useMemo(
    () => keywords.filter((k) => terms.includes(k)).length > 0,
    [terms, keywords],
  );

  return (
    <section className="mt-2">
      <Typography variant="h4" fontSize={14} fontWeight={500} color="#888">
        {title}
      </Typography>
      <div style={match ? { borderLeft: "12px solid yellow" } : {}}>
        <ul
          className="mt-1 flex list-none flex-wrap items-center"
          style={
            match ? { borderLeft: "1px solid #bbb", paddingLeft: "10px" } : {}
          }
        >
          {kw.slice(0, max).map((l, i) => (
            <li key={`rep_${i}`} className="m-[2px]">
              <Chip
                color={terms.includes(l) ? "success" : color}
                label={l}
                variant={variant}
              />
            </li>
          ))}
          {keywords.length - max > 0 && (
            <li>
              <Button
                onClick={() => setMax(keywords.length)}
                sx={{ fontSize: 12 }}
              >
                +{keywords.length - 9} more
              </Button>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
