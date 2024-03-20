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
  faCircleNodes,
  faClose,
  faMagnifyingGlass,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { useParams, useRouter } from "next/navigation";
import { useStore } from "~/app/_store";
import { api } from "~/trpc/react";

import "react-accessible-accordion/dist/fancy-example.css";
import { type Article, type Cluster } from "~/server/api/routers/post";
import { findAlongPath, getNodeData } from "~/app/_utils/graph";
import { getRawNodeData } from ".";

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
    setLocateNode,
    setOpenNode,
    geoMode,
    threats,
    selectedNode,
    setSelectedNode,
    qa,
    history,
    addQA,
    setArticleGraph,
  } = useStore();
  const { locale, day } = useParams();
  const router = useRouter();

  const data = selectedNode && getNodeData(selectedNode);
  const id = (data?.type === "cluster" && data.id) || "";

  const { data: rawGraph, isFetching } = api.post.cluster.useQuery(
    {
      id,
    },
    { enabled: data?.type === "cluster" },
  );

  const questionApi = api.post.question.useMutation();

  useEffect(() => {
    if (rawGraph) {
      setArticleGraph(rawGraph);
    }
  }, [rawGraph, setArticleGraph]);

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

  const handleGraphClick = useCallback(() => {
    if (typeof locale === "string" && typeof day === "string") {
      router.push(`/${locale}/${day}/${history}/${id}`);
    }
  }, [day, history, id, locale, router]);

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
      findAlongPath(selectedNode, "out", () => true).map((n) => getNodeData(n));

    return clusters
      ?.filter(
        (c) =>
          (!geoMode ||
            c.locations.filter(
              (l) =>
                typeof l.latitude === "number" &&
                typeof l.longitude === "number",
            ).length > 0) &&
          (!nodes || nodes.includes(c)) &&
          c.threats &&
          c.threats.filter((t) => threats.includes(t.title)).length > 0,
      )
      .map((a) => a)
      .sort((a) => {
        for (const term of searchTerms) {
          const t = term.toLowerCase();
          if (
            a.summary.toLowerCase().includes(t) ||
            a.title.toLowerCase().includes(t)
          )
            return -1;
        }
        return 0;
      });
  }, [
    clusters,
    geoMode,
    hierarchicalCluster,
    searchTerms,
    selectedNode,
    threats,
  ]);

  const handleLocate = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      const node = e.currentTarget.value;
      if (node) setLocateNode(node);
    },
    [setLocateNode],
  );

  const handleOpenCluster = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      const node = e.currentTarget.value;
      if (node) setOpenNode(node);
    },
    [setOpenNode],
  );

  return (
    <div className="flex flex-1 flex-col text-xl">
      {hierarchicalCluster && filteredClusters && (
        <>
          <h3 className="mt-0 flex justify-between bg-blue-300 p-2">
            <span>Related clusters</span>
            <span>{filteredClusters.length}</span>
          </h3>
          <div className="h-0 flex-auto overflow-auto pl-5 pr-5 text-2xl">
            {filteredClusters.map((cluster) => (
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
                      onClick={handleLocate}
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
      {data?.type === "threat" && <pre>{JSON.stringify(data, null, 2)}</pre>}
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
      {!cluster && !selectedNode && filteredClusters && (
        <>
          <h3 className="mt-0 flex justify-between bg-blue-300 p-2">
            <span>Detected Clusters</span>
            <span>{filteredClusters.length}</span>
          </h3>
          <div className="h-0 flex-auto overflow-auto pl-5 pr-5 text-2xl">
            {filteredClusters.map((cluster) => (
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
                      onClick={handleLocate}
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
                      {history && (
                        <button
                          title="Graph View"
                          className="btn btn-primary"
                          onClick={handleGraphClick}
                        >
                          <FontAwesomeIcon icon={faCircleNodes} />
                        </button>
                      )}
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
    </div>
  );
}
