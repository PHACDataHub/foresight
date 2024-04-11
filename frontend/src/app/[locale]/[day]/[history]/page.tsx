"use client";

import useParamsWithStore from "~/app/_hooks/useParamsWithStore";

export default function Index({ params }: { params: { history: string } }) {
  useParamsWithStore(params);
  return null;
}
