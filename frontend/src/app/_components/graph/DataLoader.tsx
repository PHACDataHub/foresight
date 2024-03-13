import { useOgma } from "@linkurious/ogma-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { useStore } from "~/app/_store";
import ProgressBar from "./ProgressBar";

export type Article = {
  pub_date: Date;
  gphin_state: string;
  factiva_folder: string;
  pub_time: Date;
  pub_name: string;
  factiva_file_name: string;
  id: number;
  gphin_score: number;
  title: string;
  content: string;
};

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
  node_size: number;
  start_date: Date;
  summary: string;
  title: string;
  topic_id: string;
  primary_threat: string;
  threats?: { t: Threat; r: { score: number } }[];
  articles?: Article[];
}

export interface Threat {
  type: "threat";
  title: string;
  score?: number;
}

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
  const ogma = useOgma();
  const [totalSize, setTotalSize] = useState(0);
  const [progress, setProgress] = useState(0);

  const { history } = useStore();

  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const progressTick = useRef<number>(0);

  const { isLoading, data: rawGraph } = api.post.clusters.useQuery(
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
