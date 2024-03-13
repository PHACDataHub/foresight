import { type Node as OgmaNode } from "@linkurious/ogma";
import { type ChangeEvent, useCallback, useState } from "react";
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
import { type ForesightData } from "./DataLoader";

import "react-accessible-accordion/dist/fancy-example.css";

export default function NodeInfo({
  node,
}: {
  node: OgmaNode | null | undefined;
}) {
  const { searchTerms, setSearchTerms } = useStore();
  const [search, setSearch] = useState(searchTerms.join(","));

  const data = node?.getData() as ForesightData;

  const { data: cluster } = api.post.cluster.useQuery(
    {
      id: (data && data.type === "cluster" && data.id) || "",
    },
    { enabled: data && data.type === "cluster" },
  );

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

  const groupId =
    (node?.getData("groupId") as string) ??
    (data && data.type === "threat" && data.title) ??
    "";

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
      {groupId && (
        <>
          <h3 className="mt-0 bg-blue-300 p-2">Selected Threat</h3>
          <div className="h-0 flex-auto overflow-auto pl-5 pr-5 text-2xl">
            {groupId}
          </div>
        </>
      )}
      {data && !groupId && (
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
                <ul className="list-inline">
                  {cluster.threats?.map((n, i) => {
                    return (
                      <li key={`threat${i}`}>
                        <span className="label label-info">{n.t.title}</span>
                      </li>
                    );
                  })}
                </ul>
                <p>
                  <Highlighter
                    searchWords={searchTerms}
                    textToHighlight={cluster.summary}
                  />
                </p>
                {cluster.articles?.length && (
                  <>
                    <h4 className="flex items-end">
                      Articles
                      <span className="badge ml-5">
                        <span className="text-sm">
                          {cluster.articles.length}
                        </span>
                      </span>
                    </h4>
                    <Accordion allowMultipleExpanded allowZeroExpanded>
                      {cluster.articles?.map((article, i) => (
                        <article key={`article_${i}`} className="acc-group">
                          <AccordionItem>
                            <AccordionItemHeading>
                              <AccordionItemButton>
                                {article.title}
                              </AccordionItemButton>
                            </AccordionItemHeading>
                            <AccordionItemPanel>
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
