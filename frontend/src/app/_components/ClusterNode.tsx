import { type Node as OgmaNode } from "@linkurious/ogma";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as d3 from "d3";
import {
  faAngleDown,
  faMessage,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import React, {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Typography from "@mui/material/Typography";
import InputAdornment from "@mui/material/InputAdornment";
import { styled } from "@mui/material/styles";

import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select, { type SelectChangeEvent } from "@mui/material/Select";

import { Dot } from "lucide-react";
import { type Article, type Cluster } from "~/server/api/routers/post";
import { type ClusterNodeSections, useStore } from "~/app/_store";
import {
  createScale,
  getNodeData,
  getRawNodeData,
  isLocationValid,
} from "~/app/_utils/graph";
import { api } from "~/trpc/react";
import ArticleComponent from "./graph/Article";
import { HighlightSearchTerms } from "./HighlightTerms";
import { NodeTitle } from "./NodeTitle";

const Location = styled("div")<{
  status?: "missing" | "invalid";
}>(({ status, theme }) => {
  const color = useMemo(() => {
    if (!status) return "#fff";
    if (status === "missing") return "#808080";
    if (status === "invalid") return theme.palette.error.main;
  }, [status, theme.palette.error.main]);
  const bg = useMemo(() => {
    if (!status) return theme.palette.primary.main;
    return "#fff";
  }, [status, theme.palette.primary.main]);
  return {
    ...theme.typography.button,
    fontSize: 13,
    color,
    backgroundColor: bg,
    textDecoration: status === "invalid" ? "line-through" : undefined,
    border: `1px solid ${color}`,
    borderRadius: 100,
    whiteSpace: "pretty",
    padding: "4px 10px 4px 10px",
  };
});

function ArticleList({ articles }: { articles: Article[] }) {
  const { searchMatches } = useStore();
  return (
    <>
      {articles.map((article) => (
        <Accordion
          key={article.id}
          sx={
            searchMatches.includes(`${article.id}`)
              ? { backgroundColor: "rgba(255,255,0,0.2)" }
              : undefined
          }
        >
          <AccordionSummary expandIcon={<FontAwesomeIcon icon={faAngleDown} />}>
            <Typography variant="h5">
              <HighlightSearchTerms text={article.title} />
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ArticleComponent article={article} />
          </AccordionDetails>
        </Accordion>
      ))}
    </>
  );
}

function ClusterLocations({ cluster }: { cluster: Cluster }) {
  if (!cluster?.locations) return;
  const locations = cluster.locations.filter((l) => Boolean(l.location));
  return (
    <ul className="mb-[10px] mt-[10px] flex list-none flex-wrap">
      {locations.map((l, i) => (
        <li key={`loc_${i}`} className="m-1 p-0">
          <Location
            title={!isLocationValid(l) ? "Invalid or missing coordinates" : ""}
            status={isLocationValid(l) ? undefined : "invalid"}
          >
            {l.location}
          </Location>
        </li>
      ))}
      {locations.length === 0 && (
        <Location title="No location data is available" status="missing">
          No Location
        </Location>
      )}
    </ul>
  );
}

const groupByOptions = [
  "",
  "gphin_state",
  "gphin_score",
  "pub_name",
  "pub_time",
  "pub_date",
] as const;

type GroupByOptions = (typeof groupByOptions)[number];

export function ClusterNode(
  props:
    | {
        clusterNode: OgmaNode<Cluster>;
      }
    | {
        clusterNode: OgmaNode<Cluster>;
        details: boolean;
        expand: ClusterNodeSections[];
      },
) {
  const { clusterNode } = props;
  const details = "details" in props && props.details;

  const [question, setQuestion] = useState("");
  const endOfQARef = useRef<HTMLSpanElement | null>(null);
  const [groupArticlesBy, setGroupArticlesBy] = useState<GroupByOptions>("");
  const [tab, setTab] = useState(0);

  const {
    qa,
    addQA,
    ogma,
    refresh,
    expandedClusters,
    augmentScale,
    geoMode,
    feature_GroupArticleBy,
    searchMatches,
  } = useStore();

  const id = useMemo(() => {
    if (!clusterNode) return null;
    const data = getNodeData<Cluster | undefined>(clusterNode);
    if (!data) return null;
    return data.id;
  }, [clusterNode]);

  const { data, isFetching } = api.post.cluster.useQuery(
    {
      id: id ?? "",
    },
    { enabled: Boolean(details && id), refetchOnWindowFocus: false },
  );
  const questionApi = api.post.question.useMutation();

  const cluster = useMemo(() => {
    if (details && data) {
      const c = data.nodes.find((n) => getRawNodeData(n)?.type === "cluster");
      if (!c) return null;
      return getRawNodeData<Cluster>(c);
    }
    if (clusterNode) return getNodeData<Cluster>(clusterNode);
    return null;
  }, [clusterNode, data, details]);

  const handleArticleLocate = useCallback(() => {
    if (!cluster) return;
    if (expandedClusters.includes(cluster.id)) {
      refresh();
      const node_ids = data?.nodes
        .filter((n) => getRawNodeData(n)?.type === "article")
        .map((n) => `${getRawNodeData<Article>(n).id}`);
      if (!node_ids) return;
      setTimeout(() => {
        ogma?.events.once("idle", () => {
          const nodes = ogma
            ?.getNodes()
            .filter((n) => `${getNodeData<Article>(n)?.id}` in node_ids);
          void nodes?.locate();
        });
      }, 2000);
    }
  }, [cluster, data?.nodes, expandedClusters, ogma, refresh]);

  const handleGroupArticleByChange = useCallback(
    (evt: SelectChangeEvent<string>) => {
      const value = evt.target.value as GroupByOptions;
      if (groupByOptions.includes(value)) setGroupArticlesBy(value);
    },
    [],
  );

  const handleQuestionChange = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      setQuestion(evt.target.value);
    },
    [],
  );

  const handleQuestion = useCallback(
    async (e: KeyboardEvent<HTMLInputElement>) => {
      if (!cluster) return;
      if (e.key === "Enter") {
        addQA({ clusterId: cluster.id, question });
        setQuestion("");
        try {
          setTimeout(() => {
            endOfQARef.current?.scrollIntoView();
          }, 200);
          const answer = await questionApi.mutateAsync({
            cluster_id: cluster.id,
            question,
          });
          addQA({ clusterId: cluster.id, question, answer });
        } catch (e) {
          addQA({
            clusterId: cluster.id,
            question,
            answer: [(e as Error).message],
          });
        } finally {
          setTimeout(() => {
            endOfQARef.current?.scrollIntoView();
          }, 200);
        }
      }
    },
    [addQA, cluster, question, questionApi],
  );

  useEffect(() => {
    if (!ogma || !data || !cluster) return;
    const loadData = async () => {
      const node_ids = ogma
        .getNodes()
        .map((n) => n.getId())
        .concat(data.nodes.map((n) => `${n.id}`));
      augmentScale(
        createScale({
          nodes: data.nodes.concat(
            ogma.getNodes().map((n) => ({ data: getNodeData(n) })),
          ),
          edges: data.edges,
        }),
      );
      await ogma.addGraph({
        nodes: data.nodes.map((n) => ({
          ...n,
          data: { ...n.data, cluster_id: cluster.id },
        })),
        edges: data.edges.filter(
          (e) => node_ids.includes(e.source) && node_ids.includes(e.target),
        ),
      });
      handleArticleLocate();
    };
    void loadData();
  }, [cluster, data, handleArticleLocate, ogma, augmentScale]);

  const articles = useMemo(() => {
    if (!details || !data) return [];
    return data.nodes
      .filter((n) => getRawNodeData(n)?.type === "article")
      .filter((n, i, arr) => {
        return i === arr.findIndex((b) => b.id === n.id);
      })
      .map((n) => getRawNodeData<Article>(n))
      .sort(
        (a, b) =>
          d3.descending(
            searchMatches.includes(`${a.id}`) ? 1 : 0,
            searchMatches.includes(`${b.id}`) ? 1 : 0,
          ) || d3.descending(a.gphin_score, b.gphin_score),
      );
  }, [data, details, searchMatches]);

  const handleTabChange = useCallback(
    (evt: React.SyntheticEvent, newTab: number) => {
      setTab(newTab);
    },
    [],
  );

  const showLocate = useMemo(
    () =>
      Boolean(
        !geoMode ||
          (cluster?.locations &&
            cluster.locations.filter((l) => isLocationValid(l)).length > 0),
      ),
    [cluster, geoMode],
  );

  const trashed_published = useMemo(() => {
    return articles.reduce(
      (p, c) => ({
        trashed: p.trashed + (c.gphin_state === "TRASHED" ? 1 : 0),
        published: p.published + (c.gphin_state === "PUBLISHED" ? 1 : 0),
      }),
      {
        trashed: 0,
        published: 0,
      },
    );
  }, [articles]);

  const groupedArticles = useMemo(() => {
    if (groupArticlesBy !== "" && feature_GroupArticleBy) {
      return d3.group(
        d3.sort(articles, (a, b) => {
          if (groupArticlesBy === "gphin_score")
            return d3.descending(a.gphin_score, b.gphin_score);
          if (groupArticlesBy === "pub_time")
            return (
              d3.ascending(a.pub_time?.getTime(), b.pub_time?.getTime()) ||
              d3.descending(a.gphin_score, b.gphin_score)
            );
          if (groupArticlesBy === "pub_date")
            return (
              d3.ascending(a.pub_date?.getTime(), b.pub_date?.getTime()) ||
              d3.descending(a.gphin_score, b.gphin_score)
            );
          if (groupArticlesBy === "pub_name")
            return (
              d3.ascending(a.pub_name, b.pub_name) ||
              d3.descending(a.gphin_score, b.gphin_score)
            );
          return (
            d3.ascending(a.gphin_state, b.gphin_state) ||
            d3.descending(a.gphin_score, b.gphin_score)
          );
        }),
        (a) => a[groupArticlesBy],
      );
    }
    return null;
  }, [articles, feature_GroupArticleBy, groupArticlesBy]);

  if (!cluster) return;

  if (details)
    return (
      <>
        <Tabs
          value={tab}
          className="h-[42px] pl-[30px]"
          onChange={handleTabChange}
          centered
          variant="fullWidth"
        >
          <Tab sx={{ fontSize: 14 }} label="Summary" />
          <Tab
            sx={{ fontSize: 14 }}
            label={
              <div className="flex items-center space-x-2">
                <span>Articles</span>
                <Chip
                  sx={{ fontSize: 14 }}
                  label={
                    isFetching ? (
                      <FontAwesomeIcon icon={faSpinner} spin />
                    ) : (
                      articles.length
                    )
                  }
                />
              </div>
            }
          />
        </Tabs>
        {tab === 0 && (
          <>
            <div className="flex flex-1 flex-col pl-[30px] pr-[12px] pt-[10px]">
              <div className="flex flex-1 flex-col">
                <div className="h-0 flex-auto overflow-auto pr-[12px]">
                  {showLocate && <NodeTitle dataNode={clusterNode} />}
                  {!showLocate && <NodeTitle title={cluster.title} />}

                  <ClusterLocations cluster={cluster} />

                  <section>
                    <Typography variant="body1" fontSize={14}>
                      <HighlightSearchTerms text={cluster.summary ?? ""} />
                    </Typography>
                  </section>
                  <section className="mt-[10px] border-t pt-[10px]">
                    <Typography variant="h5" fontSize={16} fontWeight={500}>
                      Questions about this cluster
                    </Typography>
                    <ul className="mt-[10px]">
                      {Object.entries(cluster.answers ?? []).map(
                        ([question, answer], i) => (
                          <li key={`${cluster.id}_question_${i}`}>
                            <Typography
                              className="flex items-center space-x-2"
                              fontWeight={500}
                              variant="body1"
                              fontSize={14}
                            >
                              <Dot size={16} />
                              <span>{question}</span>
                            </Typography>

                            <ul className="ml-10 pb-[8px]">
                              <li className="flex items-start space-x-4">
                                <FontAwesomeIcon
                                  className="mt-[4px]"
                                  icon={faMessage}
                                  fontSize={10}
                                />
                                <Typography fontSize={14} variant="body1">
                                  {answer}
                                </Typography>
                              </li>
                            </ul>
                          </li>
                        ),
                      )}
                      {qa[cluster.id]?.map(({ question, answer }, i) => (
                        <li key={`qes_${cluster.id}_${i}`}>
                          <Typography
                            className="flex items-center space-x-2"
                            fontWeight={500}
                            color="primary"
                            variant="body1"
                            fontSize={14}
                          >
                            <Dot size={16} />
                            <span>{question}</span>
                          </Typography>
                          <ul className="ml-10">
                            <li className="flex items-start space-x-4 whitespace-pre-wrap">
                              <FontAwesomeIcon
                                className="mt-[4px]"
                                icon={faMessage}
                                fontSize={10}
                              />

                              {typeof answer === "undefined" && (
                                <FontAwesomeIcon spin icon={faSpinner} />
                              )}
                              <div>
                                {answer?.map((a, i) => (
                                  <Typography
                                    variant="body1"
                                    color="secondary"
                                    className="pb-2"
                                    fontSize={14}
                                    key={`cluster_${cluster.id}-a-${i}`}
                                  >
                                    {a}
                                  </Typography>
                                ))}
                              </div>
                            </li>
                          </ul>
                        </li>
                      ))}
                    </ul>
                    <span ref={endOfQARef} />
                  </section>
                </div>
              </div>
            </div>
            <div className="flex flex-col border-t pb-[12px] pl-[30px] pr-[10px] pt-[16px]">
              <TextField
                InputLabelProps={{ sx: { fontSize: 16 } }}
                variant="outlined"
                label="Chat Console"
                placeholder="Ask a question"
                onKeyUp={handleQuestion}
                onChange={handleQuestionChange}
                value={question}
                InputProps={{
                  sx: { fontSize: 16 },
                  startAdornment: <InputAdornment position="start" />,
                }}
              />
            </div>
          </>
        )}
        {tab === 1 && (
          <div className="h-0 flex-auto flex-col space-y-[8px] overflow-scroll pl-[30px] pr-[12px] pt-[12px]">
            <div className="flex flex-col space-y-[12px]">
              <div className="flex flex-col items-center">
                <Typography variant="body1" fontSize={14}>
                  GPHIN: <b>Published</b> ({trashed_published.published}){" "}
                  <b>Trashed</b> ({trashed_published.trashed})
                </Typography>
              </div>

              {feature_GroupArticleBy && (
                <div>
                  <FormControl sx={{ minWidth: 120 }} fullWidth>
                    <InputLabel
                      id="group_articles_by_select"
                      sx={{ fontSize: 14 }}
                    >
                      Group articles by ...
                    </InputLabel>
                    <Select
                      sx={{ fontSize: 14 }}
                      labelId="group_articles_by_select"
                      value={groupArticlesBy}
                      label="Group articles by"
                      onChange={handleGroupArticleByChange}
                    >
                      <MenuItem sx={{ fontSize: 14 }} value="">
                        <em>No Grouping</em>
                      </MenuItem>
                      <MenuItem sx={{ fontSize: 14 }} value="pub_name">
                        Publication
                      </MenuItem>
                      <MenuItem sx={{ fontSize: 14 }} value="pub_time">
                        Pub Time
                      </MenuItem>
                      <MenuItem sx={{ fontSize: 14 }} value="pub_date">
                        Pub Date
                      </MenuItem>
                      <MenuItem sx={{ fontSize: 14 }} value="gphin_state">
                        GPHIN State
                      </MenuItem>
                      <MenuItem sx={{ fontSize: 14 }} value="gphin_score">
                        GPHIN Score
                      </MenuItem>
                    </Select>
                  </FormControl>
                </div>
              )}
            </div>
            {groupedArticles === null && <ArticleList articles={articles} />}
            {groupedArticles &&
              d3.map(groupedArticles, ([group, a], idx) => {
                const title =
                  typeof group === "string" || typeof group === "number"
                    ? `${group}`
                    : groupArticlesBy === "pub_date"
                      ? group?.toLocaleDateString()
                      : group?.toLocaleTimeString();

                return (
                  <section key={`group_${idx}`}>
                    <Typography
                      variant="h5"
                      className="flex items-center space-x-2"
                      sx={{
                        fontSize: 16,
                        fontWeight: 500,
                        marginBottom: 2,
                        borderBottom: "1px solid #1976d2",
                        paddingBottom: "2px",
                      }}
                    >
                      <span>{title}</span>
                      <Chip
                        sx={{ fontSize: 14 }}
                        label={
                          isFetching ? (
                            <FontAwesomeIcon icon={faSpinner} spin />
                          ) : (
                            a.length
                          )
                        }
                      />
                    </Typography>
                    <ArticleList articles={a} />
                  </section>
                );
              })}
          </div>
        )}
      </>
    );

  return (
    <section className="flex flex-1 flex-col">
      {showLocate && <NodeTitle dataNode={clusterNode} />}
      {!showLocate && <NodeTitle title={cluster.title} />}
      <ClusterLocations cluster={cluster} />
      <Typography variant="body1" fontSize={16}>
        <HighlightSearchTerms text={cluster.summary ?? ""} />
      </Typography>
    </section>
  );
}
