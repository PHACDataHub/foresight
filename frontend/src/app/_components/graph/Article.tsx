import { useMemo } from "react";
import { Typography } from "@mui/material";

import { type Node as OgmaNode } from "@linkurious/ogma";

import { type Article } from "~/server/api/routers/post";
import { NodeTitle } from "~/app/_components/NodeTitle";
import { getNodeData } from "~/app/_utils/graph";

export default function ArticleComponent({
  dataNode,
  standAlone,
}: {
  dataNode: OgmaNode;
  standAlone?: boolean;
}) {
  const article = useMemo(() => {
    return getNodeData<Article>(dataNode);
  }, [dataNode]);

  if (!article) return;

  return (
    <article className="flex flex-1 flex-col">
      <div className="mr-[12px] flex flex-col space-y-[8px] pb-[12px] pt-[12px]">
        <div className="flex space-x-2">
          <Typography variant="body1" fontSize={14}>
            Publication:
          </Typography>
          <Typography variant="body1" fontSize={14} fontWeight={500}>
            {article.pub_name}
          </Typography>
        </div>
        <div className="flex space-x-[32px] ">
          <div className="flex flex-col space-y-[8px]">
            <div className="flex space-x-1">
              <Typography variant="body1" fontSize={14}>
                Pub Time:
              </Typography>
              <Typography variant="body1" fontSize={14} fontWeight={500}>
                {article.pub_time?.toLocaleTimeString()}
              </Typography>
            </div>
            <div className="flex space-x-1">
              <Typography variant="body1" fontSize={14}>
                Pub Date:
              </Typography>
              <Typography variant="body1" fontSize={14} fontWeight={500}>
                {article.pub_date?.toLocaleDateString()}
              </Typography>
            </div>
          </div>
          <div className="flex flex-col space-y-[8px]">
            <div className="flex space-x-1">
              <Typography variant="body1" fontSize={14}>
                GPHIN State:
              </Typography>
              <Typography variant="body1" fontSize={14} fontWeight={500}>
                {article.gphin_state}
              </Typography>
            </div>
            <div className="flex space-x-1">
              <Typography variant="body1" fontSize={14}>
                GPHIN Score:
              </Typography>
              <Typography variant="body1" fontSize={14} fontWeight={500}>
                {article.gphin_score}
              </Typography>
            </div>
          </div>
        </div>
      </div>
      <div className="mr-[12px]">
        <NodeTitle dataNode={dataNode} />
      </div>

      <div
        className={`${standAlone ? "h-0 flex-auto overflow-auto pr-[12px] pt-[10px]" : ""}`}
      >
        {article.content?.split("\n").map((content, i) => (
          <Typography
            key={i}
            variant="body1"
            fontSize={16}
            className="whitespace-pre-wrap"
          >
            {content}
          </Typography>
        ))}
      </div>
    </article>
  );
}
