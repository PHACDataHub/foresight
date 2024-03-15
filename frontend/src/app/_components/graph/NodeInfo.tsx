import { type Node as OgmaNode } from "@linkurious/ogma";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import Highlighter from "react-highlight-words";

import {
  Accordion,
  AccordionItem,
  AccordionItemButton,
  AccordionItemHeading,
  AccordionItemPanel,
} from "react-accessible-accordion";

import { useStore } from "~/app/_store";
import { api } from "~/trpc/react";

import "react-accessible-accordion/dist/fancy-example.css";
import { type Article } from "~/server/api/routers/post";
import { getNodeData, getRawNodeData } from ".";

export default function NodeInfo({
  node,
}: {
  node: OgmaNode | null | undefined;
}) {
  const { searchTerms, setSearchTerms } = useStore();
  const [search, setSearch] = useState(searchTerms.join(","));

  const data = node && getNodeData(node);
  const id = (data?.type === "cluster" && data.id) || "";

  const { data: rawGraph } = api.post.cluster.useQuery(
    {
      id,
    },
    { enabled: data?.type === "cluster" },
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

  return (
    <div className="flex flex-1 flex-col">
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
            <pre>
              {JSON.stringify(hierarchicalCluster, null, 2)}
            </pre>
          </div>
        </>
      )}
      {cluster && (
        <>
          <h3 className="mt-0 bg-blue-300 p-2">Selected Cluster</h3>
          <div className="h-0 flex-auto overflow-auto pl-5 pr-5 text-2xl">
            {!cluster && "Loading..."}
            {cluster && (
              <>
                <h4 className="mt-0 flex items-end">
                  <Highlighter
                    searchWords={searchTerms}
                    textToHighlight={cluster.title}
                  />
                </h4>
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
                  <li>
                    <input
                      type="text"
                      className="w-full border p-2"
                      disabled
                      placeholder="Ask your own question"
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
                        <article key={`article_${article.id}`} className="acc-group">
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
