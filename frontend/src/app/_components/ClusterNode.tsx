import { type Node as OgmaNode } from "@linkurious/ogma";
import Highlighter from "react-highlight-words";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAngleDown,
  faAngleLeft,
  faAngleRight,
  faCircleInfo,
  faClose,
  faMagnifyingGlass,
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
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import InputAdornment from "@mui/material/InputAdornment";

import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import IconButton from "@mui/material/IconButton";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Badge from "@mui/material/Badge";
import { type Article, type Cluster } from "~/server/api/routers/post";
import { type ClusterNodeSections, useStore } from "~/app/_store";
import { createScale, getNodeData, getRawNodeData } from "~/app/_utils/graph";
import { api } from "~/trpc/react";
import ArticleComponent from "./graph/Article";

function ClusterLocations({ cluster }: { cluster: Cluster }) {
  if (!cluster?.locations) return;
  return (
    <Stack direction="row" spacing={1}>
      {cluster.locations
        .filter((l) => Boolean(l.location))
        .map((l, i) => (
          <Chip
            key={`loc_${i}`}
            color="primary"
            variant="outlined"
            label={l.location}
          />
        ))}
    </Stack>
  );
}

function ClusterTitle({
  cluster,
  clusterNode,
  details,
}: {
  cluster: Cluster;
  clusterNode: OgmaNode<Cluster>;
  details?: boolean;
}) {
  const { searchTerms, setSelectedNode } = useStore();
  const handleLocate = useCallback(async () => {
    // const node = ogma
    //   .getNodes()
    //   .filter((n) => (n.getData() as { id: string }).id === locateNode);

    // const nodes = ogma.getNodes().filter((n) => {
    //   const d = n.getData() as { id: string };
    //   if (d.id === locateNode) return true;
    //   const adj = n
    //     .getAdjacentNodes()
    //     .filter((na) => (na.getData() as { id: string }).id === locateNode);
    //   if (adj.size > 0) return true;
    //   return false;
    // });

    await clusterNode.locate();
    await clusterNode.pulse();
  }, [clusterNode]);

  const handleOpenCluster = useCallback(() => {
    clusterNode.setSelected(true);
    setSelectedNode({ node: clusterNode, expand: ["qa"] });
  }, [clusterNode, setSelectedNode]);

  const handleCloseCluster = useCallback(() => {
    clusterNode.setSelected(false);
    setSelectedNode(null);
  }, [clusterNode, setSelectedNode]);

  if (!cluster) return <></>;

  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <Typography variant="h6">
          <Highlighter
            searchWords={searchTerms}
            textToHighlight={cluster.title}
          />
        </Typography>
      </div>
      <div className="flex">
        <IconButton onClick={handleOpenCluster}>
          <FontAwesomeIcon icon={faCircleInfo} />
        </IconButton>

        <IconButton onClick={handleLocate}>
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </IconButton>

        {details && (
          <IconButton defaultValue={cluster.id} onClick={handleCloseCluster}>
            <FontAwesomeIcon icon={faClose} />
          </IconButton>
        )}
      </div>
    </div>
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

  const {
    searchTerms,
    qa,
    addQA,
    ogma,
    refresh,
    expandedClusters,
    setScale,
    showInfoPanel,
    setShowInfoPanel,
    setPanelWasToggled,
  } = useStore();

  const { data, isFetching } = api.post.cluster.useQuery(
    {
      id: clusterNode ? getNodeData<Cluster>(clusterNode).id : "",
    },
    { enabled: Boolean(details && clusterNode), refetchOnWindowFocus: false },
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
            .filter((n) => `${getNodeData<Article>(n).id}` in node_ids);
          console.log(nodes?.size);
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
        console.log(question);
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

  // const handleAddToGraph = useCallback(async () => {
  //   if (!cluster) return;
  //   toggleExpandedCluster(cluster.id);
  //   setLayout("force");
  //   refresh();
  // }, [cluster, refresh, setLayout, toggleExpandedCluster]);

  useEffect(() => {
    if (!ogma || !data || !cluster) return;
    const loadData = async () => {
      const node_ids = ogma
        .getNodes()
        .map((n) => n.getId())
        .concat(data.nodes.map((n) => `${n.id}`));
      setScale(
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
  }, [cluster, data, handleArticleLocate, ogma, setScale]);

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

  const handleNodeViewToggle = useCallback(() => {
    if (showInfoPanel) setPanelWasToggled(true);
    setShowInfoPanel(!showInfoPanel);
  }, [setPanelWasToggled, setShowInfoPanel, showInfoPanel]);

  const [tab, setTab] = useState(0);

  const handleTabChange = useCallback(
    (evt: React.SyntheticEvent, newTab: number) => {
      setTab(newTab);
    },
    [],
  );

  if (details && !showInfoPanel)
    return (
      <div
        className="flex justify-between"
        style={{ background: "rgb(90,111,196)", padding: 5 }}
      >
        <IconButton onClick={handleNodeViewToggle}>
          <FontAwesomeIcon icon={faAngleRight} color="white" />
        </IconButton>
      </div>
    );

  if (!cluster) return;

  if (details)
    return (
      <div className="flex flex-1 flex-col">
        <div
          className="flex items-center justify-between text-white"
          style={{ background: "rgb(90,111,196)", padding: 5 }}
        >
          <Typography variant="h6">Selected Cluster</Typography>
          <IconButton onClick={handleNodeViewToggle}>
            <FontAwesomeIcon
              color="white"
              icon={showInfoPanel ? faAngleLeft : faAngleRight}
            />
          </IconButton>
        </div>
        <Tabs value={tab} onChange={handleTabChange} centered>
          <Tab label="Summary" />
          <Tab
            label={
              <Badge
                badgeContent={
                  isFetching ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : (
                    articles.length
                  )
                }
                max={10000}
                color="info"
              >
                Articles
              </Badge>
            }
          />
        </Tabs>
        {tab === 0 && (
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col p-5">
              <ClusterTitle
                cluster={cluster}
                clusterNode={clusterNode}
                details={details}
              />
              <ClusterLocations cluster={cluster} />
              <div className="h-0 flex-auto overflow-auto">
                <Highlighter
                  searchWords={searchTerms}
                  textToHighlight={cluster.summary ?? ""}
                />
                <Typography variant="h6">
                  Questions about this cluster
                </Typography>
                <ul style={{ listStyleType: "circle" }}>
                  {qa[cluster.id]?.map(({ question, answer }, i) => (
                    <li className="font-bold" key={`qes_${cluster.id}_${i}`}>
                      {question}
                      <ul className="ml-10" style={{ listStyleType: "square" }}>
                        <li className="whitespace-pre-wrap font-normal">
                          {typeof answer === "undefined" && (
                            <FontAwesomeIcon spin icon={faSpinner} />
                          )}
                          {answer?.map((a, i) => (
                            <p key={`cluster_${cluster.id}-a-${i}`}>{a}</p>
                          ))}
                        </li>
                      </ul>
                    </li>
                  ))}

                  {Object.entries(cluster.answers ?? []).map(
                    ([question, answer], i) => (
                      <li key={`${cluster.id}_question_${i}`}>
                        {question}
                        <ul
                          className="ml-10"
                          style={{ listStyleType: "square" }}
                        >
                          <li>{answer}</li>
                        </ul>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
            <div className="flex flex-col border-t p-5">
              <TextField
                variant="outlined"
                label="Chat Console"
                placeholder="Ask a question"
                onKeyUp={handleQuestion}
                onChange={handleQuestionChange}
                value={question}
                InputProps={{
                  startAdornment: <InputAdornment position="start" />,
                }}
              />
            </div>
          </div>
        )}
        {tab === 1 && (
          <div className="h-0 flex-auto flex-col overflow-scroll">
            {articles.map((article) => (
              <Accordion key={article.id}>
                <AccordionSummary
                  expandIcon={<FontAwesomeIcon icon={faAngleDown} />}
                >
                  {article.title}
                </AccordionSummary>
                <AccordionDetails>
                  <ArticleComponent article={article} />
                </AccordionDetails>
              </Accordion>
            ))}
          </div>
        )}
      </div>
    );

  return (
    <section className="flex flex-1 flex-col">
      <ClusterTitle
        cluster={cluster}
        clusterNode={clusterNode}
        details={details}
      />
      <ClusterLocations cluster={cluster} />
      <Typography>
        <Highlighter
          searchWords={searchTerms}
          textToHighlight={cluster.summary ?? ""}
        />
      </Typography>
    </section>
  );
}
