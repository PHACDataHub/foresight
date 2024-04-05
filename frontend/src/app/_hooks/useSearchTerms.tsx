import { useMemo } from "react";
import { useStore } from "~/app/_store";

export function useSearchTerms() {
  const { searchTerms, searchAsYouType } = useStore();
  const terms = useMemo(() => {
    if (searchAsYouType.length > 0)
      return searchTerms
        .concat(searchAsYouType)
        .map((t) => t.toLowerCase().trim())
        .filter((t) => t.length >= 3);
    return searchTerms;
  }, [searchAsYouType, searchTerms]);

  return terms;
}
