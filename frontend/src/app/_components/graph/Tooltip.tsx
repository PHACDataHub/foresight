import {
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Skeleton,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { useOgma } from "@linkurious/ogma-react";
import {
  Flag,
  Newspaper,
  Pin,
  Send,
  SquareArrowOutUpRight,
} from "lucide-react";
import { getNodeData, getRawNodeData } from "~/app/_utils/graph";
import { type Article } from "~/server/api/routers/post";
import { api } from "~/trpc/react";
import { HighlightSearchTerms } from "~/app/_components/HighlightTerms";
import { useStore } from "~/app/_store";

export default function Tooltip({ article_id }: { article_id: number }) {
  const t = useTranslations("ArticleComponent");
  const ogma = useOgma();

  const { setSelectedNode, persona } = useStore();

  const articleQuery = api.post.getArticleQuery.useQuery({
    article_id,
    persona,
  });

  const article = useMemo(() => {
    if (!articleQuery.data) return null;
    const a = articleQuery.data.nodes.at(0);
    if (!a) return null;
    return getRawNodeData<Article>(a);
  }, [articleQuery.data]);

  const loading = useMemo(
    () => articleQuery.isFetching,
    [articleQuery.isFetching],
  );

  const handleOpenClick = useCallback(() => {
    if (!article) return;
    const n = ogma
      ?.getNodes()
      .filter(
        (n) =>
          n.getData("type") === "article" &&
          getNodeData<Article>(n)?.id === article.id,
      );
    if (n?.size === 1 && ogma) {
      const dataNode = n.get(0);
      setSelectedNode({ node: dataNode, activeTab: "articles", ogma });
      dataNode.setSelected(true);
    }
  }, [article, ogma, setSelectedNode]);

  const link = useMemo(() => {
    if (!article || !("link" in article)) return undefined;
    return article.link as string;
  }, [article]);

  return (
    <Card sx={{ width: 460 }}>
      <CardHeader
        sx={{
          paddingTop: "2px",
          paddingBottom: "2px",
          paddingLeft: 0,
          paddingRight: 0,
        }}
        title={
          <>
            <IconButton
              style={{ width: 42, height: 42, color: "#000" }}
              onClick={handleOpenClick}
              title={t("openArticle")}
            >
              <Newspaper size={22} />
            </IconButton>
            <IconButton
              style={{ width: 42, height: 42 }}
              disabled={!Boolean(link)}
              href={link ?? ""}
              target="_blank"
            >
              <SquareArrowOutUpRight size={22} />
            </IconButton>
            <IconButton style={{ width: 42, height: 42 }} disabled>
              <Pin size={22} />
            </IconButton>
            <IconButton style={{ width: 42, height: 42 }} disabled>
              <Flag size={22} />
            </IconButton>
            <IconButton style={{ width: 42, height: 42 }} disabled>
              <Send size={22} />
            </IconButton>
          </>
        }
        className="border-b"
      />
      <CardContent className="flex max-h-[500px] flex-col">
        <div className="mb-3 flex space-x-[32px] ">
          <div
            className={`flex flex-col space-y-[8px]${loading ? " flex-1" : ""}`}
          >
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
                {loading ? <Skeleton /> : article?.pub_name}
              </Typography>
            </div>

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
                  article?.pub_time?.toLocaleTimeString()
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
                  article?.pub_date?.toLocaleDateString()
                )}
              </Typography>
            </div>
          </div>
        </div>
        <Typography
          variant="h4"
          fontSize={18}
          className={loading ? "flex-1" : ""}
        >
          {loading ? (
            <Skeleton />
          ) : (
            <span className="font-bold">{article?.title}</span>
          )}
        </Typography>

        <div className="overflow-auto">
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
            article?.content?.split("\n").map((content, i) => (
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
      </CardContent>
    </Card>
  );
}
