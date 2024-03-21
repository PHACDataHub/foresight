import { useOgma } from "@linkurious/ogma-react";
import { type Neo4JEdgeData } from "@linkurious/ogma";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { api } from "~/trpc/react";
import { useStore } from "~/app/_store";
import {
  type AllDataTypes,
  type Cluster,
  type Threat,
} from "~/server/api/routers/post";
import { getNodeData, getNodeRadius } from "~/app/_utils/graph";
import ProgressBar from "./ProgressBar";

export type ForesightData = Cluster | Threat;

const MAX_RADIUS = 20;
const MIN_RADIUS = 2;

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

  const {
    everything,
    setClusters,
    setScale,
    setLocateNode,
    setSelectedNode,
    history,
    clusterId,
    articleGraph,
    refresh,
    setArticleCount,
  } = useStore();

  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const progressTick = useRef<number>(0);

  const { isFetching: isHLoading, data: rawHGraph } =
    api.post.hierarchicalClusters.useQuery(
      { day, history, everything },
      {
        refetchOnWindowFocus: false,
        enabled: typeof clusterId === "undefined",
      },
    );

  const { data: articleCount } =
    api.post.hierarchicalClustersArticleCount.useQuery(
      { day, history, everything },
      {
        refetchOnWindowFocus: false,
        enabled: typeof clusterId === "undefined",
      },
    );

  const { isFetching: isALoading, data: rawAGraph } =
    api.post.articles.useQuery(
      { cluster_id: clusterId ?? "" },
      {
        refetchOnWindowFocus: false,
        enabled: typeof clusterId !== "undefined",
      },
    );

  const isLoading = useMemo(
    () => isHLoading || isALoading,
    [isALoading, isHLoading],
  );
  const rawGraph = useMemo(
    () => (typeof clusterId === "undefined" ? rawHGraph : rawAGraph),
    [clusterId, rawAGraph, rawHGraph],
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
    if (typeof articleCount === "number") setArticleCount(articleCount);
    else setArticleCount(0);
  }, [articleCount, setArticleCount]);

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
      setSelectedNode(null);
    } else if (!isLoading && progressTimer.current !== null) {
      clearTimeout(progressTimer.current);
      progressTimer.current = null;
    }
  }, [isLoading, ogma, onLoading, setSelectedNode, tick]);

  const createScale = useCallback(() => {
    const ret: Record<
      "cluster" | "hierarchicalcluster" | "threat" | "article" | "global",
      { min?: number; max?: number }
    > = {
      cluster: {},
      hierarchicalcluster: {},
      threat: {},
      article: {},
      global: {},
    };
    ogma.getNodes().forEach((n) => {
      const data = getNodeData(n);
      if (!data) return;
      const r = getNodeRadius(data);

      const gomi = ret.global.min ?? r;
      const goma = ret.global.max ?? r;
      ret.global = {
        min: Math.min(gomi, r),
        max: Math.max(goma, r),
      };

      if (
        data?.type === "hierarchicalcluster" ||
        data?.type === "cluster" ||
        data?.type === "threat" ||
        data?.type === "article"
      ) {
        const omi = ret[data.type].min ?? r;
        const oma = ret[data.type].max ?? r;
        ret[data.type] = {
          min: Math.min(omi, r),
          max: Math.max(oma, r),
        };
      }
    });
    return {
      global:
        typeof ret.global.min === "number" && typeof ret.global.max === "number"
          ? d3
              .scaleLog([MIN_RADIUS, MAX_RADIUS])
              .domain([ret.global.min, ret.global.max])
          : null,

      cluster:
        typeof ret.cluster.min === "number" &&
        typeof ret.cluster.max === "number"
          ? d3
              .scaleLog([MIN_RADIUS * 2, MAX_RADIUS * 2])
              .domain([ret.cluster.min, ret.cluster.max])
          : null,
      hierarchicalcluster:
        typeof ret.hierarchicalcluster.min === "number" &&
        typeof ret.hierarchicalcluster.max === "number"
          ? d3
              .scaleLog([MIN_RADIUS * 1.5, MAX_RADIUS * 1.5])
              .domain([
                ret.hierarchicalcluster.min,
                ret.hierarchicalcluster.max,
              ])
          : null,

      threat:
        typeof ret.threat.min === "number" && typeof ret.threat.max === "number"
          ? d3
              .scaleLog([MIN_RADIUS * 1.7, MAX_RADIUS * 1.7])
              .domain([ret.threat.min, ret.threat.max])
          : null,

      article:
        typeof ret.article.min === "number" &&
        typeof ret.article.max === "number"
          ? d3
              .scaleLog([MIN_RADIUS / 2, MAX_RADIUS / 2])
              .domain([ret.article.min, ret.article.max])
          : null,
    };
  }, [ogma]);

  useEffect(() => {
    if (articleGraph && !ogma.geo.enabled()) {
      void (async () => {
        const node_ids = ogma
          .getNodes()
          .map((n) => n.getId())
          .concat(articleGraph.nodes.map((n) => `${n.id}`));
        await ogma.addGraph({
          nodes: articleGraph.nodes,
          edges: articleGraph.edges.filter(
            (e) => node_ids.includes(e.source) && node_ids.includes(e.target),
          ),
        });
        setScale(createScale());
        refresh();
      })();
    }
  }, [articleGraph, createScale, ogma, refresh, setScale]);

  useEffect(() => {
    if (!rawGraph) return;
    const parse = async () => {
      setTotalSize(rawGraph.nodes.length + rawGraph.edges.length);
      await ogma.setGraph(rawGraph);
      setScale(createScale());
      if (!ogma.geo.enabled()) await ogma.view.locateRawGraph(rawGraph);
      ogma.events.once("idle", () => {
        setTotalSize(0);
        onLoading && onLoading(false);
      });
    };
    if (onLoading) onLoading(true);
    setTimeout(() => void parse(), 0);
  }, [rawGraph, isLoading, ogma, onLoading, createScale, setScale]);

  useEffect(() => {
    setLocateNode(undefined);
    if (!rawGraph) {
      setClusters(undefined);
    } else {
      setClusters(
        rawGraph.nodes
          .filter((n) => n.data?.type === "cluster")
          .map((n) => n.data as Cluster)
          .sort((a, b) => {
            if (a.nr_articles > b.nr_articles) return -1;
            if (a.nr_articles < b.nr_articles) return 1;
            return 0;
          }),
      );
    }
  }, [rawGraph, setClusters, setLocateNode]);

  if (isLoading)
    return (
      <ProgressBar text="Downloading" percent={progress} showPercent={false} />
    );

  if (totalSize > 0)
    return <ProgressBar text="Rendering" totalSize={totalSize} />;

  return <></>;
}
