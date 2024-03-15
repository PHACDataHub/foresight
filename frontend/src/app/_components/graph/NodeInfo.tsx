import {
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useMemo,
  useState,
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
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { useStore } from "~/app/_store";
import { api } from "~/trpc/react";

import "react-accessible-accordion/dist/fancy-example.css";
import { type Article, type Cluster } from "~/server/api/routers/post";
import { getNodeData, getRawNodeData } from ".";

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
    setSearchTerms,
    clusters,
    setLocateNode,
    setOpenNode,
    geoMode,
    threats,
    selectedNode,
  } = useStore();
  const [search, setSearch] = useState(searchTerms.join(","));

  const [question, setQuestion] = useState("");

  const data = selectedNode && getNodeData(selectedNode);
  const id = (data?.type === "cluster" && data.id) || "";

  const { data: rawGraph, isFetching } = api.post.cluster.useQuery(
    {
      id,
    },
    { enabled: data?.type === "cluster" },
  );

  const { data: answers, isFetching: isAnswerLoading } =
    api.post.question.useQuery(
      { cluster_id: id, question },
      {
        refetchOnWindowFocus: false,
        enabled: data?.type === "cluster" && question.length > 0,
      },
    );

  const handleQuestion = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setQuestion(e.currentTarget.value);
      e.currentTarget.value = "";
    }
  }, []);

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

  const handleSearchChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setSearchTerms(
        e.target.value
          .toLowerCase()
          .split(",")
          .filter((s) => s.length > 0),
      );
    },
    [setSearchTerms],
  );

  const filteredClusters = useMemo(() => {
    return clusters?.filter(
      (c) =>
        (!geoMode ||
          c.locations.filter(
            (l) =>
              typeof l.latitude === "number" && typeof l.longitude === "number",
          ).length > 0) &&
        c.threats &&
        c.threats.filter((t) => threats.includes(t.title)).length > 0,
    );
  }, [clusters, geoMode, threats]);

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
      <h3 className="mt-0 bg-blue-300 p-2">Search terms</h3>
      <label className="flex space-x-5 p-5 font-normal">
        <span>Search</span>
        <input
          type="text"
          value={search}
          className="flex-1 border"
          onChange={handleSearchChange}
        />
      </label>
      {hierarchicalCluster && (
        <>
          <h3 className="mt-0 bg-blue-300 p-2">hierarchicalCluster</h3>
          <div className="h-0 flex-auto overflow-auto pl-5 pr-5 text-2xl">
            <pre>{JSON.stringify(hierarchicalCluster, null, 2)}</pre>
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
                  <h4>{cluster.title}</h4>
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
                <p>{cluster.summary}</p>
              </section>
            ))}
          </div>
        </>
      )}
      {selectedNode && isFetching && "Loading..."}
      {cluster && (
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
                  {question.length > 0 && (
                    <li className="font-bold">
                      {question}
                      <ul className="ml-10" style={{ listStyleType: "square" }}>
                        <li className="whitespace-pre-wrap font-normal">
                          {isAnswerLoading && "Processing..."}
                          {answers?.map((a, i) => (
                            <p key={`cluster_${cluster.id}-a-${i}`}>{a}</p>
                          ))}
                        </li>
                      </ul>
                    </li>
                  )}
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
                    <h4 className="flex items-end">
                      Articles
                      <span className="badge ml-5">
                        <span className="text-sm">{articles.length}</span>
                      </span>
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
