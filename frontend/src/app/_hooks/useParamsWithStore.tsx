"use client";

import { useEffect } from "react";
import { useStore } from "~/app/_store";

export default function useParamsWithStore(
  params: { clusterId: string } | { history: string } | { day: string },
) {
  const store = useStore();
  useEffect(() => {
    if ("clusterId" in params) {
      if (params.clusterId !== "") {
        if (store.clusterId !== params.clusterId) {
          store.setClusterId(params.clusterId);
        }
      } else {
        store.setClusterId(undefined);
      }
    } else if (store.clusterId) store.setClusterId(undefined);
    if ("history" in params) {
      if (store.persona === "tom") {
        store.setHistory(undefined);
        return;
      }
      const t = parseInt(params.history);
      if (t === 3 || t === 7 || t === 30) {
        if (store.history !== t) {
          store.setSelectedNode(null);
          store.setHistory(t);
          if (t === 30) store.setEverything(false);
        }
        return;
      }
      if (store.history) store.setHistory(undefined);
    } else if (store.history) store.setHistory(undefined);
  }, [params, store]);
  return <></>;
}
