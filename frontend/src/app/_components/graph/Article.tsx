import { Typography } from "@mui/material";

import { type Article } from "~/server/api/routers/post";
import { NodeTitle } from "~/app/_components/NodeTitle";
import { HighlightSearchTerms } from "~/app/_components/HighlightTerms";

export default function ArticleComponent({
  article,
  standAlone,
}: {
  article: Article;
  standAlone?: boolean;
}) {
  return (
    <article className="flex flex-1 flex-col">
      <div
        className={`${standAlone ? "h-0 flex-auto overflow-auto pr-[12px] pt-[10px]" : ""}`}
      >
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

        {standAlone && (
          <div className="mr-[12px]">
            <NodeTitle title={article.title} />
          </div>
        )}

        {article.content?.split("\n").map((content, i) => (
          <Typography
            key={i}
            variant="body1"
            fontSize={14}
            lineHeight={1.4}
            mt={1}
            className="whitespace-pre-wrap"
          >
            <HighlightSearchTerms text={content} />
          </Typography>
        ))}
      </div>
    </article>
  );
}
