import { type Node as OgmaNode } from "@linkurious/ogma";
import Highlighter from "react-highlight-words";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleInfo,
  faClose,
  faMagnifyingGlass,
  faShareNodes,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { type KeyboardEvent, useCallback, useEffect, useMemo } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionItemButton,
  AccordionItemHeading,
  AccordionItemPanel,
} from "react-accessible-accordion";

import { type Article, type Cluster } from "~/server/api/routers/post";
import { type ClusterNodeSections, useStore } from "~/app/_store";
import { createScale, getNodeData, getRawNodeData } from "~/app/_utils/graph";
import { api } from "~/trpc/react";

function ClusterLocations({ cluster }: { cluster: Cluster }) {
  if (!cluster?.locations) return;
  return (
    <ul className="list-inline">
      {cluster.locations.map((l, i) => (
        <li key={`loc_${i}`}>
          <span className="label label-info">{l.location}</span>
        </li>
      ))}
    </ul>
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
    <div
      className="flex items-center justify-between"
      style={
        details
          ? { background: "rgb(90,111,196)", padding: 5, color: "white" }
          : undefined
      }
    >
      <h4>
        <Highlighter
          searchWords={searchTerms}
          textToHighlight={cluster.title}
        />
      </h4>
      <div className="flex space-x-2">
        <button value={cluster.id} onClick={handleOpenCluster}>
          <FontAwesomeIcon icon={faCircleInfo} />
        </button>
        <button value={cluster.id} onClick={handleLocate}>
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </button>
        {details && (
          <button value={cluster.id} onClick={handleCloseCluster}>
            <FontAwesomeIcon icon={faClose} />
          </button>
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
  const expand = ("expand" in props && props.expand) || [];

  const {
    searchTerms,
    qa,
    addQA,
    ogma,
    setLayout,
    refresh,
    toggleExpandedCluster,
    expandedClusters,
    setScale,
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
      console.log("--- frefreshing...---");
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

  const handleQuestion = useCallback(
    async (e: KeyboardEvent<HTMLInputElement>) => {
      if (!cluster) return;
      if (e.key === "Enter") {
        const question = e.currentTarget.value;
        addQA({ clusterId: cluster.id, question });
        e.currentTarget.value = "";
        const answer = await questionApi.mutateAsync({
          cluster_id: cluster.id,
          question,
        });
        addQA({ clusterId: cluster.id, question, answer });
      }
    },
    [addQA, cluster, questionApi],
  );

  const handleAddToGraph = useCallback(async () => {
    if (!cluster) return;
    toggleExpandedCluster(cluster.id);
    setLayout("force");
    refresh();
  }, [cluster, refresh, setLayout, toggleExpandedCluster]);

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

  if (!cluster) return;

  if (details)
    return (
      <div className="flex h-0 flex-auto flex-col overflow-auto pl-5 pr-5 text-2xl">
        <ClusterTitle
          cluster={cluster}
          clusterNode={clusterNode}
          details={details}
        />
        <ClusterLocations cluster={cluster} />
        <Accordion
          key={JSON.stringify(expand)}
          allowMultipleExpanded
          allowZeroExpanded
          preExpanded={expand}
        >
          <AccordionItem uuid="summary">
            <AccordionItemHeading>
              <AccordionItemButton>Summary</AccordionItemButton>
            </AccordionItemHeading>
            <AccordionItemPanel>
              <p>
                <Highlighter
                  searchWords={searchTerms}
                  textToHighlight={cluster.summary ?? ""}
                />
              </p>
            </AccordionItemPanel>
          </AccordionItem>
          <AccordionItem uuid="qa">
            <AccordionItemHeading>
              <AccordionItemButton>Insights</AccordionItemButton>
            </AccordionItemHeading>
            <AccordionItemPanel>
              <ul style={{ listStyleType: "circle" }}>
                <li>
                  <input
                    type="text"
                    className="w-full border p-2"
                    placeholder="Ask a question"
                    onKeyUp={handleQuestion}
                  />
                </li>

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

                {Object.entries(cluster.answers).map(
                  ([question, answer], i) => (
                    <li key={`${cluster.id}_question_${i}`}>
                      {question}
                      <ul className="ml-10" style={{ listStyleType: "square" }}>
                        <li>{answer}</li>
                      </ul>
                    </li>
                  ),
                )}
              </ul>
            </AccordionItemPanel>
          </AccordionItem>
          <AccordionItem uuid="articles">
            <AccordionItemHeading>
              <AccordionItemButton>Articles</AccordionItemButton>
            </AccordionItemHeading>
            <AccordionItemPanel>
              <div className="flex justify-end">
                <button
                  className="btn"
                  onClick={handleAddToGraph}
                  title="Add Articles to graph"
                >
                  <FontAwesomeIcon icon={faShareNodes} />
                </button>
              </div>

              {!isFetching && (
                <Accordion allowMultipleExpanded allowZeroExpanded>
                  {articles?.map((article) => (
                    <article
                      key={`article_${article.id}`}
                      className="acc-group"
                    >
                      <AccordionItem>
                        <AccordionItemHeading>
                          <AccordionItemButton>
                            {article.title}
                          </AccordionItemButton>
                        </AccordionItemHeading>
                        <AccordionItemPanel>
                          <Accordion allowZeroExpanded>
                            <AccordionItem>
                              <AccordionItemHeading>
                                <AccordionItemButton>
                                  Details
                                </AccordionItemButton>
                              </AccordionItemHeading>
                              <AccordionItemPanel>
                                <div className="row">
                                  <div className="col-xs-6">Id</div>
                                  <div className="col-xs-6">{article.id}</div>

                                  <div className="col-xs-6">Publication</div>
                                  <div className="col-xs-6">
                                    {article.pub_name}
                                  </div>
                                  <div className="col-xs-6">
                                    Publication Date
                                  </div>
                                  <div className="col-xs-6">
                                    {article.pub_date.toLocaleDateString()}
                                  </div>
                                  <div className="col-xs-6">
                                    Publication Time
                                  </div>
                                  <div className="col-xs-6">
                                    {new Date(
                                      article.pub_time,
                                    ).toLocaleTimeString()}
                                  </div>
                                  <div className="col-xs-6">Factiva Folder</div>
                                  <div className="col-xs-6">
                                    {article.factiva_folder ?? "Not available"}
                                  </div>
                                  <div className="col-xs-6">
                                    Factiva Filename
                                  </div>
                                  <div className="col-xs-6">
                                    {article.factiva_file_name ??
                                      "Not available"}
                                  </div>
                                  <div className="col-xs-6">GPHIN Score</div>
                                  <div className="col-xs-6">
                                    {article.gphin_score}
                                  </div>
                                  <div className="col-xs-6">GPHIN State</div>
                                  <div className="col-xs-6">
                                    {article.gphin_state}
                                  </div>
                                </div>
                              </AccordionItemPanel>
                            </AccordionItem>
                          </Accordion>
                          <p className="whitespace-pre-wrap leading-10">
                            {article.content}
                          </p>
                        </AccordionItemPanel>
                      </AccordionItem>
                    </article>
                  ))}
                </Accordion>
              )}
            </AccordionItemPanel>
          </AccordionItem>
        </Accordion>
        {isFetching && (
          <div className="flex flex-1 items-center justify-center">
            <FontAwesomeIcon icon={faSpinner} size="4x" spin />
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
      <p>
        <Highlighter
          searchWords={searchTerms}
          textToHighlight={cluster.summary}
        />
      </p>
    </section>
  );
}
