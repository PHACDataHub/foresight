"use client";

import useParamsWithStore from "~/app/_hooks/useParamsWithStore";

export default function Index({ params }: { params: { day: string } }) {
  useParamsWithStore(params);
  return null;
}
Index.displayName="Index";
