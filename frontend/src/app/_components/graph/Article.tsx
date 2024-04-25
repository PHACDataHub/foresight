import { useCallback, useEffect, useState } from "react";

import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";

import { useTranslations } from "next-intl";
import { type Article } from "~/server/api/routers/post";
import { Title } from "~/app/_components/Title";
import { HighlightSearchTerms } from "~/app/_components/HighlightTerms";
import { getNodeColor } from "~/app/_utils/graph";
import { api } from "~/trpc/react";

export default function ArticleComponent({
  article: articleNode,
  standAlone,
}: {
  article: Article;
  standAlone?: boolean;
}) {
  const getArticle = api.post.getArticle.useMutation();
  const [article, setArticle] = useState(articleNode);
  const [loading, setLoading] = useState(false);

  const t = useTranslations("ArticleComponent");

  const fetchArticle = useCallback(
    async (article_id: number, cluster_id: string) => {
      setLoading(true);
      const a = await getArticle.mutateAsync({ article_id, cluster_id });
      setLoading(false);
      const articleData = a.nodes.at(0);
      const data = articleData?.data as Article | undefined;
      if (data) setArticle(data);
    },
    [getArticle],
  );

  useEffect(() => {
    setArticle(articleNode);
    if (articleNode.data__incomplete__) {
      void fetchArticle(articleNode.id, articleNode.cluster_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleNode]);

  return (
    <article className="flex flex-1 flex-col">
      <div
        className={`${standAlone ? "h-0 flex-auto overflow-auto pr-[12px] pt-[10px]" : ""}`}
      >
        <div className="mr-[12px] flex flex-col space-y-[8px] pb-[12px] pt-[12px]">
          <div className="flex space-x-2">
            <Typography
              variant="body1"
              fontSize={14}
              className={loading ? "flex-1" : ""}
            >
              {loading ? <Skeleton /> : t("publication")}
            </Typography>

            <Typography
              variant="body1"
              fontSize={14}
              fontWeight={500}
              className={loading ? "flex-1" : ""}
            >
              {loading ? <Skeleton /> : article.pub_name}
            </Typography>
          </div>
          <div className="flex space-x-[32px] ">
            <div
              className={`flex flex-col space-y-[8px]${loading ? " flex-1" : ""}`}
            >
              <div className="flex space-x-1">
                <Typography
                  variant="body1"
                  fontSize={14}
                  className={loading ? "flex-1" : ""}
                >
                  {loading ? <Skeleton /> : t("pubTime")}
                </Typography>
                <Typography
                  variant="body1"
                  fontSize={14}
                  fontWeight={500}
                  className={loading ? "flex-1" : ""}
                >
                  {loading ? (
                    <Skeleton />
                  ) : (
                    article.pub_time?.toLocaleTimeString()
                  )}
                </Typography>
              </div>
              <div className="flex space-x-1">
                <Typography
                  variant="body1"
                  fontSize={14}
                  className={loading ? "flex-1" : ""}
                >
                  {loading ? <Skeleton /> : t("pubDate")}
                </Typography>
                <Typography
                  variant="body1"
                  fontSize={14}
                  fontWeight={500}
                  className={loading ? "flex-1" : ""}
                >
                  {loading ? (
                    <Skeleton />
                  ) : (
                    article.pub_date?.toLocaleDateString()
                  )}
                </Typography>
              </div>
            </div>
            <div
              className={`flex flex-col space-y-[8px]${loading ? " flex-1" : ""}`}
            >
              <div className="flex space-x-1">
                <Typography
                  variant="body1"
                  fontSize={14}
                  className={loading ? "flex-1" : ""}
                >
                  {loading ? <Skeleton /> : t("state")}
                </Typography>
                <Typography
                  variant="body1"
                  fontSize={14}
                  fontWeight={500}
                  className={loading ? "flex-1" : ""}
                >
                  {loading ? <Skeleton /> : article.gphin_state}
                </Typography>
              </div>
              <div className="flex space-x-1">
                <Typography
                  variant="body1"
                  fontSize={14}
                  className={loading ? "flex-1" : ""}
                >
                  {loading ? <Skeleton /> : t("score")}
                </Typography>
                <Typography
                  variant="body1"
                  fontSize={14}
                  fontWeight={500}
                  className={loading ? "flex-1" : ""}
                >
                  {loading ? <Skeleton /> : article.gphin_score}
                </Typography>
              </div>
            </div>
          </div>
          {article.outlier && (
            <div className="flex space-x-1">
              <Typography
                variant="body1"
                fontSize={14}
                fontWeight={500}
                className="border p-2 text-white"
                style={{ backgroundColor: getNodeColor(article) }}
              >
                {t("outlier")}
              </Typography>
            </div>
          )}
        </div>

        {standAlone && (
          <div className="mr-[12px]">
            <Title title={article.title} />
          </div>
        )}

        {loading ? (
          <>
            <Typography
              variant="body1"
              fontSize={14}
              lineHeight={1.4}
              mt={1}
              className="whitespace-pre-wrap"
            >
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </Typography>
            <Typography
              variant="body1"
              fontSize={14}
              lineHeight={1.4}
              mt={1}
              className="whitespace-pre-wrap"
            >
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </Typography>
            <Typography
              variant="body1"
              fontSize={14}
              lineHeight={1.4}
              mt={1}
              className="whitespace-pre-wrap"
            >
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </Typography>
          </>
        ) : (
          article.content?.split("\n").map((content, i) => (
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
          ))
        )}
      </div>
    </article>
  );
}
