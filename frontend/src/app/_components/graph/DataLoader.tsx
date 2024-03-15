import { useOgma } from "@linkurious/ogma-react";
import { type Neo4JEdgeData } from "@linkurious/ogma";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { useStore } from "~/app/_store";
import {
  type AllDataTypes,
  type Cluster,
  type Threat,
} from "~/server/api/routers/post";
import ProgressBar from "./ProgressBar";

export type ForesightData = Cluster | Threat;

export default function DataLoader({
  day,
  onLoading,
  // threats,
}: {
  day: number;
  onLoading?: (loading: boolean) => void;
  // threats: string[];
}) {
  const ogma = useOgma<AllDataTypes, Neo4JEdgeData<Record<string, unknown>>>();
  const [totalSize, setTotalSize] = useState(0);
  const [progress, setProgress] = useState(0);

  const { history } = useStore();

  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const progressTick = useRef<number>(0);

  const { isLoading, data: rawGraph } = api.post.hierarchicalClusters.useQuery(
    { day, history },
    {
      refetchOnWindowFocus: false,
    },
  );

  const tick = useCallback(() => {
    progressTimer.current = setTimeout(() => {
      progressTick.current += 3;
      if (progressTick.current >= 100) progressTick.current = 0;
      setProgress(progressTick.current);
      tick();
    }, 200);
  }, []);

  useEffect(() => {
    if (isLoading && progressTimer.current === null) {
      if (onLoading) {
        console.log(`-- event -- ${isLoading ? "Loading" : "Done"}`);
        onLoading(isLoading);
      }
      setTotalSize(0);
      setProgress(0);
      tick();
      ogma.clearGraph();
    } else if (!isLoading && progressTimer.current !== null) {
      clearTimeout(progressTimer.current);
      progressTimer.current = null;
    }
  }, [isLoading, ogma, onLoading, tick]);

  useEffect(() => {
    if (!rawGraph) return;
    const parse = async () => {
      setTotalSize(rawGraph.nodes.length + rawGraph.edges.length);
      await ogma.setGraph(rawGraph);
      await ogma.view.locateRawGraph(rawGraph);
      ogma.events.once("idle", () => {
        setTotalSize(0);
        onLoading && onLoading(false);
      });
    };
    if (onLoading) onLoading(true);
    setTimeout(() => void parse(), 0);
  }, [rawGraph, isLoading, ogma, onLoading]);

  if (isLoading)
    return (
      <ProgressBar text="Downloading" percent={progress} showPercent={false} />
    );

  if (totalSize > 0)
    return <ProgressBar text="Rendering" totalSize={totalSize} />;

  return <></>;
}
