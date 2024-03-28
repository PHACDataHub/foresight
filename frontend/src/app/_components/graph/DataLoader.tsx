import { useOgma } from "@linkurious/ogma-react";
import { type Neo4JEdgeData, type NodeList } from "@linkurious/ogma";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { useStore } from "~/app/_store";
import {
  type AllDataTypes,
  type Cluster,
  type Threat,
} from "~/server/api/routers/post";
import { createScale, getNodeData } from "~/app/_utils/graph";
import ProgressBar from "./ProgressBar";

export type ForesightData = Cluster | Threat;

export default function DataLoader({
  day,
  onLoading,
}: {
  day: number;
  onLoading?: (loading: boolean) => void;
}) {
  const ogma = useOgma<AllDataTypes, Neo4JEdgeData<Record<string, unknown>>>();
  const [totalSize, setTotalSize] = useState(0);
  const [progress, setProgress] = useState(0);

  const {
    everything,
    setClusters,
    clearSelections,
    setScale,
    history,
    clusterId,
    setArticleCount,
    threats,
  } = useStore();

  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const progressTick = useRef<number>(0);

  // Fetch the main graph data based on day, history and threats selected.
  const { isFetching, data: rawGraph } = api.post.hierarchicalClusters.useQuery(
    { day, history, everything, threats },
    {
      refetchOnWindowFocus: false,
      enabled: typeof clusterId === "undefined",
    },
  );

  // Fetch total number of articles available.
  const { data: articleCount } =
    api.post.hierarchicalClustersArticleCount.useQuery(
      { day, history, everything, threats },
      {
        refetchOnWindowFocus: false,
        enabled: typeof clusterId === "undefined",
      },
    );

  // Update the article count when the data is available.
  useEffect(() => {
    if (typeof articleCount === "number") setArticleCount(articleCount);
    else setArticleCount(0);
  }, [articleCount, setArticleCount]);

  // Progress tick callback
  const tick = useCallback(() => {
    progressTimer.current = setTimeout(() => {
      progressTick.current += 3;
      if (progressTick.current >= 100) progressTick.current = 0;
      setProgress(progressTick.current);
      tick();
    }, 200);
  }, []);

  useEffect(() => {
    if (isFetching && progressTimer.current === null) {
      // Data is being fetched and no progress timer currently exists
      if (onLoading) {
        onLoading(isFetching);
      }
      setTotalSize(0);
      setProgress(0);
      tick();
      ogma.clearGraph();
      clearSelections();
    } else if (!isFetching && progressTimer.current !== null) {
      // Data is no longer being fetched, and there is a timer running.
      clearTimeout(progressTimer.current);
      progressTimer.current = null;
    }
  }, [clearSelections, isFetching, ogma, onLoading, tick]);

  useEffect(() => {
    if (!rawGraph) {
      setClusters(undefined);
      return;
    }
    const parse = async () => {
      setTotalSize(rawGraph.nodes.length + rawGraph.edges.length);
      setScale(createScale(rawGraph));
      await ogma.setGraph(rawGraph);
      setClusters(
        ogma
          .getNodes()
          .filter((n) => getNodeData(n)?.type === "cluster")
          .sort((a, b) => {
            const anr = getNodeData<Cluster>(a)?.nr_articles;
            const bnr = getNodeData<Cluster>(b)?.nr_articles;
            if (typeof anr === "undefined" || typeof bnr === "undefined")
              return 0;
            if (anr > bnr) return -1;
            if (anr < bnr) return 1;
            return 0;
          }) as NodeList<Cluster>,
      );

      if (!ogma.geo.enabled()) await ogma.view.locateRawGraph(rawGraph);
      ogma.events.once("idle", () => {
        setTotalSize(0);
        onLoading && onLoading(false);
      });
    };
    if (onLoading) onLoading(true);
    setTimeout(() => void parse(), 0);
  }, [ogma, onLoading, rawGraph, setClusters, setScale]);

  if (isFetching)
    return (
      <ProgressBar text="Downloading" percent={progress} showPercent={false} />
    );

  if (totalSize > 0)
    return <ProgressBar text="Rendering" totalSize={totalSize} />;

  return <></>;
}
