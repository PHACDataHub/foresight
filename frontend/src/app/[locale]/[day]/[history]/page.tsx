"use client";

import { useEffect } from "react";
import { useStore } from "~/app/_store";

export default function Index({ params }: { params: { history: string } }) {
  const store = useStore();
  useEffect(() => {
    const t = parseInt(params.history);
    if (t === 3 || t === 7 || t === 30) {
      if (store.history !== t) {
        store.setHistory(t);
      }
      return;
    }
    if (store.history) store.setHistory(undefined);
  }, [params, params.history, store]);
  return <></>;
}
