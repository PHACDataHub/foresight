import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import Highlighter from "react-highlight-words";

import {
  Accordion,
  AccordionItem,
  AccordionItemButton,
  AccordionItemHeading,
  AccordionItemPanel,
} from "react-accessible-accordion";

import {
  faCircleInfo,
  faClose,
  faMagnifyingGlass,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { useStore } from "~/app/_store";
import { api } from "~/trpc/react";

import "react-accessible-accordion/dist/fancy-example.css";
import { type Article, type Cluster } from "~/server/api/routers/post";
import { findAlongPath, getNodeData, getRawNodeData } from "~/app/_utils/graph";
import ClusterNodeList from "~/app/_components/ClusterNodeList";
import { ClusterNode } from "~/app/_components/ClusterNode";

function ClusterLocations({ cluster }: { cluster: Cluster }) {
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

export default function NodeInfo() {
  const {
    searchTerms,
    clusters,
    setOpenNode,
    geoMode,
    selectedNode,
    setSelectedNode,
    qa,
    addQA,
    setArticleGraph,
    _loadArticleGraph,
    loadArticleGraph,
  } = useStore();

  const data = selectedNode && getNodeData(selectedNode.node);
  const id = (data?.type === "cluster" && data.id) || "";

  const { data: rawGraph, isFetching } = api.post.cluster.useQuery(
    {
      id,
    },
    { enabled: data?.type === "cluster", refetchOnWindowFocus: false },
  );

  const questionApi = api.post.question.useMutation();

  useEffect(() => {
    if (rawGraph && _loadArticleGraph > 0) {
      setArticleGraph(rawGraph);
      loadArticleGraph();
    }
  }, [_loadArticleGraph, loadArticleGraph, rawGraph, setArticleGraph]);

  const handleCloseClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const handleQuestion = useCallback(
    async (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const question = e.currentTarget.value;
        addQA({ clusterId: id, question });
        e.currentTarget.value = "";
        const answer = await questionApi.mutateAsync({
          cluster_id: id,
          question,
        });
        addQA({ clusterId: id, question, answer });
      }
    },
    [addQA, id, questionApi],
  );

  const cluster = useMemo(() => {
    const c = rawGraph?.nodes.find(
      (n) => getRawNodeData(n)?.type === "cluster",
    );
    if (!c) return null;
    const data = getRawNodeData(c);
    if (data?.type === "cluster") return data;
    return null;
  }, [rawGraph?.nodes]);

  const hierarchicalCluster = useMemo(() => {
    if (!data) return null;
    if (data?.type === "hierarchicalcluster") return data;
    return null;
  }, [data]);

  const articles = useMemo(() => {
    return (
      rawGraph?.nodes
        .filter((n) => getRawNodeData(n)?.type === "article")
        .filter((n, i, arr) => {
          return i === arr.findIndex((b) => b.id === n.id);
        })
        .map((n) => {
          const data = getRawNodeData(n);
          return data as Article;
        }) ?? []
    );
  }, [rawGraph?.nodes]);

  const filteredClusters = useMemo(() => {
    const nodes =
      selectedNode &&
      hierarchicalCluster &&
      findAlongPath(selectedNode.node, "out", () => true);

    return clusters
      ?.filter(
        (c) =>
          (!geoMode ||
            getNodeData<Cluster>(c).locations.filter(
              (l) =>
                typeof l.latitude === "number" &&
                typeof l.longitude === "number",
            ).length > 0) &&
          (!nodes || nodes.includes(c)),
      )
      .map((a) => a)
      .sort((a) => {
        for (const term of searchTerms) {
          const t = term.toLowerCase();
          const c = getNodeData<Cluster>(a);
          if (
            c.summary.toLowerCase().includes(t) ||
            c.title.toLowerCase().includes(t)
          )
            return -1;
        }
        return 0;
      });
  }, [clusters, geoMode, hierarchicalCluster, searchTerms, selectedNode]);

  const handleOpenCluster = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      const node = e.currentTarget.value;
      if (node) setOpenNode(node);
    },
    [setOpenNode],
  );

  if (selectedNode && getNodeData(selectedNode.node)?.type === "cluster") {
    return (
      <div className="flex flex-1 flex-col text-xl">
        <ClusterNode
          clusterNode={selectedNode.node}
          expand={selectedNode.expand}
          details
        />
      </div>
    );
  }

  if (!cluster && !selectedNode && clusters)
    return (
      <div className="flex flex-col">
        <ClusterNodeList clusterNodes={clusters} />
      </div>
    );

  return (
    <div className="flex flex-1 flex-col">
      {hierarchicalCluster && filteredClusters && (
        <>
          <h3 className="mt-0 flex justify-between bg-blue-300 p-2">
            <span>Related clusters</span>
            <span>{filteredClusters.length}</span>
          </h3>
          <div className="h-0 flex-auto overflow-auto pl-5 pr-5 text-2xl">
            {filteredClusters
              .map((node) => getNodeData<Cluster>(node))
              .map((cluster) => (
                <section key={`cluster${cluster.id}`}>
                  <div className="flex items-center justify-between">
                    <h4>
                      <Highlighter
                        searchWords={searchTerms}
                        textToHighlight={cluster.title}
                      />
                    </h4>
                    <div className="flex space-x-2">
                      <button
                        value={cluster.id}
                        className="btn btn-primary"
                        onClick={handleOpenCluster}
                      >
                        <FontAwesomeIcon icon={faCircleInfo} />
                      </button>
                      <button
                        value={cluster.id}
                        className="btn btn-primary"
                        // onClick={handleLocate}
                      >
                        <FontAwesomeIcon icon={faMagnifyingGlass} />
                      </button>
                    </div>
                  </div>
                  <ClusterLocations cluster={cluster} />
                  <p>
                    <Highlighter
                      searchWords={searchTerms}
                      textToHighlight={cluster.summary}
                    />
                  </p>
                </section>
              ))}
          </div>
        </>
      )}
      {data?.type === "threat" && (
        <>
          <div className="flex items-start pl-5 pr-5">
            <h1 className="gc-thickline">{data.title}</h1>
            <button className="btn" title="Close" onClick={handleCloseClick}>
              <FontAwesomeIcon icon={faClose} />
            </button>
          </div>
          <div className="p-5">
            <ul className="list-inline">
              <li>
                <span className="label label-danger">Threat</span>
              </li>
            </ul>
            <table>
              <thead>
                <tr>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{data.score}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
      {data?.type === "article" && (
        <>
          <div className="flex items-start pl-5 pr-5">
            <h1 className="gc-thickline">{data.title}</h1>
            <button className="btn" title="Close" onClick={handleCloseClick}>
              <FontAwesomeIcon icon={faClose} />
            </button>
          </div>
          {data.outlier && (
            <ul className="list-inline">
              <li>
                <span className="label label-info">Outlier</span>
              </li>
            </ul>
          )}
          <div className="h-0 flex-auto overflow-auto pl-5 pr-5 text-2xl">
            <div className="float-right flex flex-col border border-gray-300 p-5">
              <table>
                <tbody>
                  <tr>
                    <th>Publication</th>
                    <td>{data.pub_name}</td>
                  </tr>
                  <tr>
                    <th>Pub Date</th>
                    <td>{data.pub_date.toLocaleDateString()}</td>
                  </tr>
                  <tr>
                    <th>Pub Time</th>
                    <td>{data.pub_time.toLocaleTimeString()}</td>
                  </tr>
                  <tr>
                    <th className="pr-5">GPHIN Score</th>
                    <td>{data.gphin_score}</td>
                  </tr>
                  <tr>
                    <th>GPHIN State</th>
                    <td>{data.gphin_state}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="whitespace-pre-wrap leading-10">{data.content}</p>
          </div>
        </>
      )}
      {selectedNode && isFetching && (
        <div className="flex flex-1 items-center justify-center">
          <FontAwesomeIcon icon={faSpinner} size="4x" spin />
        </div>
      )}
      {!isFetching && cluster && (
        <>
          <h3 className="mt-0 bg-blue-300 p-2">Selected Cluster</h3>
          <div className="h-0 flex-auto overflow-auto pl-5 pr-5 text-2xl">
            {cluster && (
              <>
                <h4 className="mt-0 flex items-end">
                  TEST
                  <Highlighter
                    searchWords={searchTerms}
                    textToHighlight={cluster.title}
                  />
                </h4>
                {cluster.labels.length > 1 && (
                  <ul className="list-inline">
                    {cluster.labels.map((label, i) => (
                      <li key={`${cluster.id}-label-${i}`}>
                        <span className="label label-primary">{label}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <ClusterLocations cluster={cluster} />
                {/* <ul className="list-inline">
                  {cluster.threats?.map((n, i) => {
                    return (
                      <li key={`threat${i}`}>
                        <span className="label label-info">{n.t.title}</span>
                      </li>
                    );
                  })}
                </ul> */}
                <p>
                  <Highlighter
                    searchWords={searchTerms}
                    textToHighlight={cluster.summary}
                  />
                </p>
                <h4>Questions about this cluster</h4>
                <ul>
                  {Object.entries(cluster.answers).map(
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
                  {qa[id]?.map(({ question, answer }, i) => (
                    <li className="font-bold" key={`qes_${id}_${i}`}>
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

                  <li>
                    <input
                      type="text"
                      className="w-full border p-2"
                      placeholder="Ask your own question"
                      onKeyUp={handleQuestion}
                    />
                  </li>
                </ul>
                {articles.length > 0 && (
                  <>
                    <h4 className="flex items-center justify-between">
                      <div className="flex items-end">
                        Articles
                        <span className="badge ml-5">
                          <span className="text-sm">{articles.length}</span>
                        </span>
                      </div>
                    </h4>
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
                                      <div className="col-xs-6">
                                        {article.id}
                                      </div>

                                      <div className="col-xs-6">
                                        Publication
                                      </div>
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
                                      <div className="col-xs-6">
                                        Factiva Folder
                                      </div>
                                      <div className="col-xs-6">
                                        {article.factiva_folder ??
                                          "Not available"}
                                      </div>
                                      <div className="col-xs-6">
                                        Factiva Filename
                                      </div>
                                      <div className="col-xs-6">
                                        {article.factiva_file_name ??
                                          "Not available"}
                                      </div>
                                      <div className="col-xs-6">
                                        GPHIN Score
                                      </div>
                                      <div className="col-xs-6">
                                        {article.gphin_score}
                                      </div>
                                      <div className="col-xs-6">
                                        GPHIN State
                                      </div>
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
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
      {selectedNode &&
        !selectedNode.node.getId()?.toString().startsWith("_gen_") && (
          <pre className="m-5 text-right text-xs">
            Node id: {selectedNode.node.getId()}
          </pre>
        )}
    </div>
  );
}
