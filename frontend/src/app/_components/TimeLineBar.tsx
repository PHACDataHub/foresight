import { useCallback, useMemo, useRef } from "react";

import ReactApexChart from "react-apexcharts";

import type OgmaLib from "@linkurious/ogma";
import type { NodeFilter, RawEdge, RawNode } from "@linkurious/ogma";

import { getNodeData, getRawNodeData } from "~/app/_utils/graph";
import { type AllDataTypes } from "~/server/api/routers/post";

export default function TimeLineBar({
  ogma,
  rawGraph,
  startDate,
  endDate,
}: {
  ogma: OgmaLib;
  rawGraph: {
    nodes: RawNode<AllDataTypes>[];
    edges: RawEdge<unknown>[];
  };
  startDate: Date;
  endDate: Date;
}) {
  const nodeFilters = useRef<NodeFilter<unknown, unknown>[]>([]);
  const days = useMemo(() => {
    return Number(
      ((endDate.getTime() - startDate.getTime()) / 86400000).toFixed(0),
    );
  }, [endDate, startDate]);

  const timelineData = useMemo(() => {
    const categories: string[] = [];
    const data: number[] = [];
    const articles: number[][] = [];
    const clusters: string[][] = [];
    for (let x = 1; x <= days; x += 1) {
      const baseDate = new Date(startDate);
      const fDate = new Date(startDate);
      baseDate.setDate(baseDate.getDate() + x);
      fDate.setDate(fDate.getDate() + (x - 1));
      categories.push(baseDate.toDateString());
      const clusterIds: string[] = [];
      const nodes = rawGraph.nodes.filter((n) => {
        const d = getRawNodeData(n);
        if (d?.type !== "article" || !d.pub_date) return false;
        const f =
          d.pub_date.getFullYear() === fDate.getFullYear() &&
          d.pub_date.getMonth() === fDate.getMonth() &&
          d.pub_date.getDate() === fDate.getDate();
        if (f) clusterIds.push(d.cluster_id);
        return f;
      });
      clusters.push(Array.from(new Set(clusterIds)));
      data.push(nodes.length);
      articles.push(
        nodes.map((n) => {
          const m = getRawNodeData(n);
          if (m?.type === "article") return m.id;
          return -1;
        }),
      );
    }
    return { categories, data, articles, clusters };
  }, [days, rawGraph.nodes, startDate]);

  const handleTimeLineSelect = useCallback(
    (
      evt: unknown,
      context: unknown,
      config: { selectedDataPoints: [number[]] },
    ) => {
      if (timelineData) {
        nodeFilters.current.forEach((t) => void t.destroy());
        nodeFilters.current = [];
        if (config.selectedDataPoints[0].length > 0) {
          const articles = config.selectedDataPoints.reduce(
            (a, b) =>
              a.concat(
                b.reduce(
                  (p, c) => p.concat(timelineData.articles[c] ?? []),
                  [] as number[],
                ),
              ),
            [] as number[],
          );
          const clusters = config.selectedDataPoints.reduce(
            (a, b) =>
              a.concat(
                b.reduce(
                  (p, c) => p.concat(timelineData.clusters[c] ?? []),
                  [] as string[],
                ),
              ),
            [] as string[],
          );

          nodeFilters.current.push(
            ogma.transformations.addNodeFilter((n) => {
              const d = getNodeData(n);
              if (d?.type !== "article") return true;
              return articles.includes(d.id);
            }),
          );
          nodeFilters.current.push(
            ogma.transformations.addNodeFilter((n) => {
              const d = getNodeData(n);
              if (d?.type !== "cluster") return true;
              return clusters.includes(d.id);
            }),
          );
        }
      }
    },
    [ogma.transformations, timelineData],
  );

  const chartOptions = useMemo(
    () => ({
      chart: {
        toolbar: {
          show: false,
        },
        zoom: {
          enabled: false,
        },
        events: {
          dataPointSelection: handleTimeLineSelect,
        },
      },
      // tooltip: {
      //   enabled: false,
      // },
      plotOptions: {
        bar: {
          columnWidth: "80%",
        },
      },
      dataLabels: {
        enabled: false,
      },
      yaxis: {
        title: {
          text: "Articles",
        },
        // labels: {
        //   formatter: function (y) {
        //     return y.toFixed(0) + "%";
        //   },
        // },
      },
      xaxis: {
        type: "date" as "datetime",
        categories: timelineData.categories,
        labels: {
          rotate: -90,
        },
      },
    }),
    [handleTimeLineSelect, timelineData.categories],
  );

  const chartSeries = useMemo(
    () => [
      {
        name: "Articles",
        data: timelineData.data,
      },
    ],
    [timelineData.data],
  );

  return (
    <ReactApexChart
      type="bar"
      height="90%"
      series={chartSeries}
      options={chartOptions}
    />
  );
}
