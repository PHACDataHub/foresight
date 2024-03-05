import { useOgma } from "@linkurious/ogma-react";
import OgmaLib from "@linkurious/ogma";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import ProgressBar from "./ProgressBar";
import { type Country } from ".";

export default function DataLoader({ countries }: { countries: Country[] }) {
  const ogma = useOgma();
  const [totalSize, setTotalSize] = useState(0);
  const [progress, setProgress] = useState(0);

  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const progressTick = useRef<number>(0);

  const { isLoading, data: rawGraph } = api.post.articles.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

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
          const base = {
            ...n,
            data: {
              ...n.data,
              start: new Date("2019-12-31"),
              end:  new Date("2019-12-31"),
            },
          };
          if (n.data?.neo4jLabels.includes("Topic")) return base;
          const c = n.data?.neo4jProperties?.countries;
          if (c && Array.isArray(c) && c.length > 0) {
            for (const country of countries) {
              if (c.includes(country.country)) {
                return {
                  ...base,
                  data: {
                    ...n.data,
                    geo: country,
                  },
                };
              }
            }
          }
          return base;
        }),
        edges: g.edges,
      };
      setTotalSize(graph.nodes.length + graph.edges.length);
      await ogma.view.locateRawGraph(graph);
      await ogma.setGraph(graph, { batchSize: 500 });
      setTotalSize(0);
    };
    void parse();
  }, [rawGraph, isLoading, countries, ogma]);

  if (isLoading)
    return (
      <ProgressBar text="Downloading" percent={progress} showPercent={false} />
    );

  if (totalSize > 0)
    return <ProgressBar text="Rendering" totalSize={totalSize} />;

  return <></>;
}
