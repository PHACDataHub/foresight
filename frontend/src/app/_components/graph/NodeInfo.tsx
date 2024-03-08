// import { useOgma } from "@linkurious/ogma-react";
import { type Node as OgmaNode } from "@linkurious/ogma";
import { type ForesightData } from "./DataLoader";

export default function NodeInfo({
  node,
}: {
  node: OgmaNode | null | undefined;
}) {
//   const ogma = useOgma();

  if (!node) return null;

  const data = node.getData() as ForesightData;

  return (
    <div className="absolute left-2 top-2 flex h-[400px] w-6/12 flex-col border-2 border-black bg-white">
      <h4 className="mt-0 bg-blue-300 p-2">Temporary Placement</h4>
      <div className="flex-1 overflow-auto p-2">
        <h5 className="mt-0">
          {data.type === "cluster" && data.title}
          {data.type === "threat" && data.title}
        </h5>
        <p>{data.type === "cluster" && data.summary}</p>
      </div>
    </div>
  );
}
