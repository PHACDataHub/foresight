import { createRef, type RefObject, useEffect, useMemo, useState } from "react";

import type OgmaLib from "@linkurious/ogma";
import type { RawEdge, RawNode } from "@linkurious/ogma";

import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { Button } from "@mui/base/Button";

import { MinusCircle } from "lucide-react";

import { type AllDataTypes } from "~/server/api/routers/post";

import Graph from "./graph";

export default function ClusterGrowth({
  rawGraph,
  clusterId,
  startDate,
  endDate,
}: {
  rawGraph: {
    nodes: RawNode<AllDataTypes>[];
    edges: RawEdge<unknown>[];
  };
  clusterId: string;
  startDate: Date;
  endDate: Date;
}) {
  const days = useMemo(() => {
    return Number(
      ((endDate.getTime() - startDate.getTime()) / 86400000).toFixed(0),
    );
  }, [endDate, startDate]);

  const [timeline, setTimeline] = useState(
    history ? [0, Number(((days - 1) / 2).toFixed(0)), days - 1] : [],
  );

  useEffect(() => {
    setTimeline([0, Number(((days - 1) / 2).toFixed(0)), days - 1]);
  }, [days]);

  const graphs = useMemo(() => {
    const ret: {
      date: Date;
      ref: RefObject<OgmaLib>;
      nodes: RawNode<AllDataTypes>[];
      edges: RawEdge[];
      index: number;
    }[] = [];

    // const nums = [0, Number(((history - 1) / 2).toFixed(0)), history - 1];
    for (let x = 0; x < days; x += 1) {
      const date = new Date(startDate.getTime() + x * 86400000);
      const fdate = new Date(startDate.getTime() + (x + 1) * 86400000);
      const filtered_out: string[] = [];
      const nodes =
        rawGraph?.nodes.filter((n) => {
          if (n.data?.type === "cluster" && n.data.id == clusterId) {
            return true;
          } else if (
            n.data?.type === "article" &&
            n.data.cluster_id === clusterId
          ) {
            if (date.getTime() >= (n.data.pub_date?.getTime() ?? 0)) {
              return true;
            }
          }
          filtered_out.push(n.id as string);
          return false;
        }) ?? [];
      ret.push({
        date: fdate,
        ref: createRef<OgmaLib>(),
        index: x,
        edges:
          rawGraph?.edges.filter(
            (e) =>
              !filtered_out.includes(e.source as string) &&
              !filtered_out.includes(e.target as string),
          ) ?? [],
        nodes: nodes,
      });
    }

    return ret;
  }, [clusterId, days, rawGraph?.edges, rawGraph?.nodes, startDate]);

  return (
    <div className="relative flex flex-wrap justify-center space-x-2 border-t pt-2">
      {graphs.map((g, i) => {
        return (
          <div key={`day_${i}`}>
            {g && timeline.includes(i) && (
              <div
                className="flex flex-col border"
                style={{
                  animation:
                    "show 400ms 100ms cubic-bezier(0.38, 0.97, 0.56, 0.76) forwards",
                  transform: "rotate(0.25turn)",
                }}
              >
                <div className="flex bg-gray-100 p-2">
                  <Typography variant="h4" fontSize={14} className="p-2">
                    {g.date.toDateString()}
                  </Typography>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      const nr = timeline.filter((x) => x !== i);
                      setTimeline(nr);
                    }}
                  >
                    <MinusCircle size={16} />
                  </IconButton>
                </div>
                <Graph graph={g} noControls layout="force" ref={g.ref} />
              </div>
            )}
            {g && !timeline.includes(i) && (
              <div
                className="flex h-[140px] bg-gray-100"
                style={{
                  writingMode: "vertical-lr",
                  animation:
                    "show 200ms 50ms cubic-bezier(0.38, 0.97, 0.56, 0.76) forwards",
                  transform: "rotate(-0.25turn)",
                  transformOrigin: "top left",
                }}
              >
                <Button
                  className="p-2"
                  onClick={() => {
                    const nr = timeline.concat();
                    nr.push(i);
                    setTimeline(nr);
                  }}
                >
                  <Typography fontSize={14} component="span" className="p-2">
                    {g.date.toDateString()}
                  </Typography>
                </Button>
              </div>
            )}
          </div>
        );
      })}
      {/*

      FOR paired interactions
       <div className="pointer-events-none absolute z-[800] flex h-full w-full flex-col">
  <h6>&nbsp;</h6>
  <canvas className="flex-1" ref={canvasRef} />
</div> */}
    </div>
  );
}


  // Select selected node in subgraphs
  // useEffect(() => {
  //   setTimeout(() => {
  //     if (!selectedNode?.node) return;
  //     graphs.forEach((g) => {
  //       const view = g?.ref.current;
  //       if (!view) return;
  //       void view.getNode(selectedNode.node.getId())?.setSelected(true);
  //     });
  //   }, 0);
  // }, [graphs, selectedNode?.node]);

  /* Create paired interactions */
  // useEffect(() => {
  //   // const drawBridges = () => {
  //   //   const canvas = canvasRef.current;
  //   //   if (!canvas) return;
  //   //   const context = canvas.getContext("2d");
  //   //   if (!context) return;
  //   //   canvas.width = canvas.clientWidth;
  //   //   canvas.height = canvas.clientHeight;
  //   //   context.clearRect(0, 0, canvas.width, canvas.height);
  //   //   context.lineWidth = 2;
  //   //   context.setLineDash([8, 4]);
  //   //   context.strokeStyle = "#888888";
  //   //   for (let x = 0; x < graphs.length - 1; x += 1) {
  //   //     const view0 = graphs[x - 1]?.ref.current;
  //   //     const view1 = graphs[x]?.ref.current;
  //   //     const view2 = graphs[x + 1]?.ref.current;
  //   //     if (!view1 || !view2) continue;
  //   //     const vw = view1.view.getSize().width;
  //   //     const bw = view0 ? view0.view.getSize().width : 0;

  //   //     view1.getNodes().forEach((n) => {
  //   //       const n2 = view2.getNode(n.getId());
  //   //       if (n2) {
  //   //         const { x, y } = n2.getPositionOnScreen();
  //   //         const { x: sx, y: sy } = n.getPositionOnScreen();
  //   //         context.beginPath();
  //   //         context.moveTo(bw + sx, sy);
  //   //         context.lineTo(bw + x + vw, y);
  //   //         context.stroke();
  //   //       }
  //   //     });
  //   //   }
  //   // };
  //   const handleSelected = (ev: NodesEvent<unknown, unknown>) => {
  //     ev.nodes.forEach((s) => {
  //       graphs.forEach((g) => {
  //         const view = g?.ref.current;
  //         if (!view) return;
  //         const n = view.getNode(s.getId());
  //         void view.getNodes().removeClass("selected");
  //         if (s !== n) {
  //           void n?.addClass("selected");
  //           // n?.setSelected(true);
  //         }
  //       });
  //     });
  //   };
  //   setTimeout(() => {
  //     graphs.forEach((g) => {
  //       const view = g?.ref.current;
  //       if (!view) return;
  //       if (!view.styles.getClass("selected"))
  //         view.styles.createClass({
  //           name: "selected",
  //           nodeAttributes: {
  //             halo: {
  //               color: "red",
  //               width: 3,
  //               strokeWidth: 3,
  //             },
  //           },
  //         });
  //       view.events.on("nodesSelected", handleSelected);
  //       // view.events.on(["nodesDragProgress", "move", "zoom"], drawBridges);
  //     });
  //   }, 0);
  //   return () => {
  //     graphs.forEach((g) => {
  //       const view = g?.ref.current;
  //       if (!view) return;
  //       view.events.off(handleSelected);
  //       // view.events.off(drawBridges);
  //     });
  //   };
  // }, [graphs]);