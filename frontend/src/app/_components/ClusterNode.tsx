import { type Node as OgmaNode } from "@linkurious/ogma";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
import { Chip } from "@mui/material";
import { type Article, type Cluster } from "~/server/api/routers/post";
import { type ClusterNodeSections, useStore } from "~/app/_store";
import { createScale, getNodeData, getRawNodeData } from "~/app/_utils/graph";
import { api } from "~/trpc/react";
import ArticleComponent from "./graph/Article";
import { HighlightSearchTerms } from "./HighlightTerms";
import { NodeTitle } from "./NodeTitle";

const Location = styled("div")(({ theme }) => {
  return {
    ...theme.typography.button,
    fontSize: 13,
    color: theme.palette.primary.main,
    border: `1px solid ${theme.palette.primary.main}`,
    borderRadius: 100,
    whiteSpace: "pretty",
    padding: "4px 10px 4px 10px",
  };
});

function ClusterLocations({ cluster }: { cluster: Cluster }) {
  if (!cluster?.locations) return;
  return (
    <ul className="mb-[10px] mt-[10px] flex list-none flex-wrap">
      {cluster.locations
        .filter((l) => Boolean(l.location))
        .map((l, i) => (
          <li key={`loc_${i}`} className="m-1 p-0">
            <Location>{l.location}</Location>
          </li>
        ))}
    </ul>
  );
}

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

  const { qa, addQA, ogma, refresh, expandedClusters, augmentScale } =
    useStore();

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
      .map((n) => {
        const data = getRawNodeData<Article>(n);
        return data;
      });
  }, [data, details]);

  const [tab, setTab] = useState(0);

  const handleTabChange = useCallback(
    (evt: React.SyntheticEvent, newTab: number) => {
      setTab(newTab);
    },
    [],
  );

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
                <NodeTitle dataNode={clusterNode} />
                <ClusterLocations cluster={cluster} />

                <div className="h-0 flex-auto overflow-auto">
                  <section>
                    <Typography variant="body1" fontSize={16}>
                      <HighlightSearchTerms text={cluster.summary ?? ""} />
                    </Typography>
                  </section>
                  <section className="mt-[10px] border-t pt-[10px]">
                    <Typography variant="h5" fontSize={18}>
                      Questions about this cluster
                    </Typography>
                    <ul className="mt-[10px]">
                      {qa[cluster.id]?.map(({ question, answer }, i) => (
                        <li key={`qes_${cluster.id}_${i}`}>
                          <Typography
                            color="primary"
                            variant="body1"
                            fontSize={16}
                          >
                            &gt; {question}
                          </Typography>
                          <ul className="ml-10">
                            <li className="flex items-center space-x-4 whitespace-pre-wrap">
                              <FontAwesomeIcon icon={faMessage} fontSize={10} />
                              {typeof answer === "undefined" && (
                                <FontAwesomeIcon spin icon={faSpinner} />
                              )}
                              <div>
                                {answer?.map((a, i) => (
                                  <Typography
                                    variant="body1"
                                    color="secondary"
                                    className="pb-2"
                                    fontSize={16}
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

                      {Object.entries(cluster.answers ?? []).map(
                        ([question, answer], i) => (
                          <li key={`${cluster.id}_question_${i}`}>
                            <Typography variant="body1" fontSize={16}>
                              &gt; {question}
                            </Typography>

                            <ul className="ml-10">
                              <li className="flex items-center space-x-4">
                                <FontAwesomeIcon
                                  icon={faMessage}
                                  fontSize={10}
                                />
                                <Typography fontSize={16} variant="body1">
                                  {answer}
                                </Typography>
                              </li>
                            </ul>
                          </li>
                        ),
                      )}
                    </ul>
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
          <div className="h-0 flex-auto flex-col overflow-scroll pl-[30px] pr-[12px] pt-[12px]">
            {articles.map((article) => (
              <Accordion key={article.id}>
                <AccordionSummary
                  expandIcon={<FontAwesomeIcon icon={faAngleDown} />}
                >
                  <Typography variant="h5">
                    {article.title}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <ArticleComponent article={article} />
                </AccordionDetails>
              </Accordion>
            ))}
          </div>
        )}
      </>
    );

  return (
    <section className="flex flex-1 flex-col">
      <NodeTitle dataNode={clusterNode} />
      <ClusterLocations cluster={cluster} />
      <Typography variant="body1" fontSize={16}>
        <HighlightSearchTerms text={cluster.summary ?? ""} />
      </Typography>
    </section>
  );
}
