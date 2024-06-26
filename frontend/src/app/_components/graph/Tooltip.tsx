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
import { type Node as OgmaNode } from "@linkurious/ogma";
import { useOgma } from "@linkurious/ogma-react";
import {
  Boxes,
  Flag,
  Newspaper,
  Pin,
  Send,
  SquareArrowOutUpRight,
} from "lucide-react";
import { api } from "~/trpc/react";
import { HighlightSearchTerms } from "~/app/_components/HighlightTerms";
import { useStore } from "~/app/_store";

const hasProp = (obj: unknown, key: string | string[]) => {
  if (!obj) return false;
  if (Array.isArray(key)) {
    for (const k of key) {
      if (Object.hasOwn(obj, k)) return true;
    }
    return false;
  }
  return Object.hasOwn(obj, key);
};

function getProp<T = string>(obj: unknown, keys: string | string[]): T | null {
  if (!obj || typeof obj !== "object") return null;
  if (Array.isArray(keys)) {
    for (const k of keys) {
      if (k in obj) {
        if (Object.hasOwn(obj, k)) {
          return obj[k as keyof typeof obj] as T;
        }
      }
    }
    return null;
  }
  if (keys in obj) return obj[keys as keyof typeof obj] as T;
  return null;
}

export default function Tooltip({ target }: { target: OgmaNode }) {
  const t = useTranslations("ArticleComponent");
  const ogma = useOgma();

  const { setSelectedNode, persona } = useStore();

  const nodeid = useMemo(() => {
    return Number(target.getId());
  }, [target]);

  const nodeQuery = api.post.getNode.useQuery({
    nodeid,
    persona,
  });

  const data = useMemo(() => {
    if (!nodeQuery.data) return null;
    const a = nodeQuery.data.nodes.at(0);
    if (!a?.data) return null;
    return a.data as object;
  }, [nodeQuery.data]);

  const loading = useMemo(() => nodeQuery.isFetching, [nodeQuery.isFetching]);

  const handleOpenClick = useCallback(() => {
    if (!data) return;
    const n = ogma?.getNodes().filter((n) => n.getId() === target.getId());
    if (n?.size === 1 && ogma) {
      const dataNode = n.get(0);
      setSelectedNode({
        node: dataNode,
        activeTab:
          target.getData("type") === "article" ? "articles" : "summary",
        ogma,
      });
      dataNode.setSelected(true);
    }
  }, [data, ogma, setSelectedNode, target]);

  const link = useMemo(() => {
    if (!data) return undefined;
    if ("link" in data) return data.link as string;
    return undefined;
  }, [data]);

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
              style={{ width: 42, height: 42, color: "#666" }}
              onClick={handleOpenClick}
              title={t("open")}
            >
              {target.getData("type") === "article" ? (
                <Newspaper size={22} />
              ) : (
                <Boxes size={22} />
              )}
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
            {hasProp(data, "pub_name") && (
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
                  {loading ? <Skeleton /> : getProp(data, ["pub_name"])}
                </Typography>
              </div>
            )}
            {hasProp(data, "pub_time") && (
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
                    getProp<Date>(data, ["pub_time"])?.toLocaleTimeString()
                  )}
                </Typography>
              </div>
            )}
            {hasProp(data, "pub_date") && (
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
                    getProp<Date>(data, ["pub_date"])?.toLocaleDateString()
                  )}
                </Typography>
              </div>
            )}
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
            <span className="font-bold">
              {getProp(data, ["title", "name"])}
            </span>
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
            (getProp(data, ["summary", "content"]) ?? "")
              .split("\n")
              .map((content, i) => (
                <Typography
                  key={i}
                  variant="body1"
                  fontSize={14}
                  lineHeight={1.4}
                  mt={1}
                  className="whitespace-pre-wrap"
                ><HighlightSearchTerms text={content.trim()} /></Typography>
              ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
