import { type NodeId, type NodeList } from "@linkurious/ogma";
import { useOgma } from "@linkurious/ogma-react";
import { useCallback, useEffect } from "react";
import { getNodeData } from "~/app/_utils/graph";
import { type Cluster } from "~/server/api/routers/post";

const colDist = 750;
const rowDist = 750;

export default function ClusterTimeEvolution() {
  const ogma = useOgma();
  const timeLayout = useCallback(
    async (clusters: NodeList<unknown, unknown>) => {
      const sorted_clusters = clusters.sort((a, b) => {
        const ad = getNodeData<Cluster>(a);
        const bd = getNodeData<Cluster>(b);
        if (!ad || !bd) return 0;
        if (ad.nr_articles > bd.nr_articles) return -1;
        if (ad.nr_articles < bd.nr_articles) return 1;
        return 0;
      });
      const rowIndex = Object.fromEntries(
        Array.from(
          new Set(sorted_clusters.map((n) => n.getData("id") as string)),
        ).map((id, i) => [id, i * rowDist]),
      );
      const xs: number[] = [];
      const dates = sorted_clusters.reduce((dates, cluster) => {
        const date = cluster.getData("cluster_date") as string;
        const d = dates as Record<string, NodeId[]>;
        d[date] = d[date] ?? [];
        d[date]?.push(cluster.getId());
        return d;
      }, {}) as Record<string, NodeId[]>;
      await Promise.all(
        Object.entries(dates)
          .sort(([a], [b]) => {
            const t1 = new Date(a);
            const t2 = new Date(b);
            return t1.getTime() - t2.getTime();
          })
          .reduce(
            (promises, [, nodeIds], i, arr) => {
              const nodes = ogma.getNodes(nodeIds);
              const x = (i - arr.length / 2) * colDist;
              xs.push(x);
              promises.push(
                nodes.concat(nodes.getAdjacentNodes()).setAttribute("x", x),
              );
              promises.push(
                nodes.setAttribute(
                  "y",
                  nodes.map((n) => rowIndex[n.getData("id") as string] ?? 0),
                ),
              );
              nodes.forEach((n) => {
                const y = rowIndex[n.getData("id") as string] ?? 0;
                promises.push(n.getAdjacentNodes().setAttribute("y", y));
              });

              return promises;
            },
            [] as Promise<NodeList<unknown, unknown>>[],
          ),
      );
      const { maxX, maxY } = ogma.view.getBounds();

      // vertical year lines
      const yearlines = ogma.layers.addCanvasLayer((ctx) => {
        const size = ogma.view.getSize();
        const lb = ogma.view.screenToGraphCoordinates({ x: 0, y: 0 });
        const rt = ogma.view.screenToGraphCoordinates({
          x: size.width,
          y: size.height,
        });
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = "#444";
        ctx.beginPath();
        xs.forEach((x) => {
          ctx.moveTo(x, lb.y);
          ctx.lineTo(x, rt.y);
        });
        ctx.stroke();
      });
      yearlines.moveToBottom();

      // year tooltips
      const overlays = Object.keys(dates)
        .sort((a, b) => {
          const t1 = new Date(a);
          const t2 = new Date(b);
          return t1.getTime() - t2.getTime();
        })
        .map((date, i) => {
          const div = document.createElement("span");
          div.classList.add("timeline");
          const p = document.createElement("p");
          p.innerText = date;
          div.appendChild(p);
          return ogma.layers.addOverlay({
            element: div,
            position: { x: xs[i] ?? 0, y: maxY - 50 },
            scaled: false,
          });
        });

      // cluster titles
      const titleOverlays = Object.keys(rowIndex).map((clusterId) => {
        const div = document.createElement("span");
        div.classList.add("timeline_cluster");
        const p = document.createElement("p");
        p.innerText = clusters
          .filter((n) => n.getData("id") === clusterId)
          .getData("title")
          .pop() as string;
        div.appendChild(p);
        return ogma.layers.addOverlay({
          element: div,
          position: { x: maxX - 50, y: rowIndex[clusterId] ?? 0 },
          scaled: false,
        });
      });

      const handleViewChanged = () => {
        requestAnimationFrame(() => {
          const { minY, minX } = ogma.view.getBounds();
          overlays.forEach((o, i) => {
            o.show();
            o.setPosition({ x: xs[i] ?? 0, y: minY });
          });
          titleOverlays.forEach((o, i) => {
            o.show();
            o.setPosition({
              x: minX,
              y: rowIndex[Object.keys(rowIndex)[i] ?? 0] ?? 0,
            });
          });
        });
      };
      ogma.events.on(["viewChanged", "pan"], handleViewChanged);

      return () => {
        console.log("disconnect...");
        ogma.events.off(handleViewChanged);
        overlays.forEach((o) => o.destroy());
        titleOverlays.forEach((o) => o.destroy());
      };
    },
    [ogma],
  );

  useEffect(() => {
    const clusters = ogma
      .getNodes()
      .filter((n) => n.getData("type") === "cluster");
    let cb: null | (() => void) = null;

    timeLayout(clusters)
      .then(async (c) => {
        cb = c;
        // await clusters.setAttribute("layoutable", false);
        // await ogma.layouts.force({
        //   duration: 0,
        //   locate: true,
        //   // incremental: true,
        //   charge: 5,
        //   gravity: 0,
        // });
        // await clusters.setAttribute("layoutable", true);

        for (let x = 0; x < clusters.size; x += 1) {
          // break;
          const c = clusters.get(x);
          void ogma.layouts.force({
            duration: 0,
            centralNode: c,
            nodes: c.getAdjacentNodes().concat(c as unknown as NodeList),
            // locate: true,
            gpu: true,
          });
        }
      })
      .catch(() => {
        console.log("error caught");
      });
    return () => {
      if (cb) cb();
    };
  }, [ogma, timeLayout]);
  return <></>;
}
