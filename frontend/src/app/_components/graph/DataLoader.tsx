import { useOgma } from "@linkurious/ogma-react";
import OgmaLib from "@linkurious/ogma";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import ProgressBar from "./ProgressBar";

export type ClusterQA = {
  score: number;
  question: string;
  answer: string;
};

export interface Cluster {
  type: "cluster";
  answers: ClusterQA[];
  id: string;
  nr_articles: number;
  start_date: Date;
  summary: string;
  title: string;
  topic_id: string;
}

export interface Threat {
  type: "threat";
  title: string;
}

export type ForesightData = Cluster | Threat;

export default function DataLoader({
  day,
  // threats,
}: {
  day: number;
  // threats: string[];
}) {
  const ogma = useOgma();
  const [totalSize, setTotalSize] = useState(0);
  const [progress, setProgress] = useState(0);

  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const progressTick = useRef<number>(0);

  const { isLoading, data: rawGraph } = api.post.articles.useQuery(
    { day },
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
      tick();
    } else if (!isLoading && progressTimer.current !== null) {
      clearTimeout(progressTimer.current);
    }
  }, [isLoading, tick]);

  useEffect(() => {
    if (!rawGraph) return;
    const parse = async () => {
      const g = await OgmaLib.parse.neo4j(rawGraph);
      const graph = {
        nodes: g.nodes.map((n) => {
          const data = n.data?.neo4jProperties;
          if (data && n.data?.neo4jLabels.includes("Threat")) {
            return {
              ...n,
              data: {
                type: "threat",
                title: (data.text as string) ?? "No text",
              } as Threat,
            };
          } else if (data && n.data?.neo4jLabels.includes("Cluster")) {
            return {
              ...n,
              data: {
                type: "cluster",
                answers: JSON.parse(
                  (data.answers as string) ?? "[]",
                ) as ClusterQA[],
                id: data.id,
                nr_articles: parseInt(data.nr_articles as string),
                start_date: new Date(),
                summary: data.summary,
                title: data.title,
                topic_id: data.topic_id,
              } as Cluster,
            };
          } else return n;
        }),
        edges: g.edges,
      };
      setTotalSize(graph.nodes.length + graph.edges.length);
      await ogma.view.locateRawGraph(graph);
      await ogma.setGraph(graph, { batchSize: 500 });
      setTotalSize(0);
    };
    void parse();
  }, [rawGraph, isLoading, ogma]);

  if (isLoading)
    return (
      <ProgressBar text="Downloading" percent={progress} showPercent={false} />
    );

  if (totalSize > 0)
    return <ProgressBar text="Rendering" totalSize={totalSize} />;

  return <></>;
}
