import type OgmaLib from "@linkurious/ogma";
import { type RawNode } from "@linkurious/ogma";
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
import { useTranslations } from "next-intl";
import {
  type AllDataTypes,
  type Article,
  type Cluster,
} from "~/server/api/routers/post";
import { type ClusterNodeSection, useStore } from "~/app/_store";
import { getDataId, getRawNodeData, isLocationValid } from "~/app/_utils/graph";
import { api } from "~/trpc/react";
import ArticleComponent from "./graph/Article";
import { HighlightSearchTerms } from "./HighlightTerms";
import { Title } from "./Title";

const Location = styled("div")<{
  status?: "missing" | "invalid";
}>(({ status, theme }) => {
  const color = useMemo(() => {
    if (!status) return "#fff";
    if (status === "missing") return "#808080";
    if (status === "invalid") return theme.palette.error.main;
  }, [status, theme.palette.error.main]);
  const bg = useMemo(() => {
    if (!status) return "#808080";
    return "#fff";
  }, [status]);
  return {
    ...theme.typography.button,
    fontSize: 13,
    color,
    backgroundColor: bg,
    textDecoration: status === "invalid" ? "line-through" : undefined,
    border: `1px solid ${color}`,
    borderRadius: 8,
    whiteSpace: "pretty",
    padding: "4px 10px 4px 10px",
  };
});

function ArticleList({ articles }: { articles: Article[] }) {
  const { searchMatches } = useStore();
  return (
    <>
      {articles.map((article, idx) => (
        <div
          key={`${idx}--${article.id}`}
          style={
            searchMatches.includes(`${article.id}`)
              ? { borderLeft: "12px solid yellow" }
              : undefined
          }
        >
          <Accordion
            sx={
              searchMatches.includes(`${article.id}`)
                ? { borderLeft: "1px solid #bbb" }
                : undefined
            }
          >
            <AccordionSummary
              expandIcon={<FontAwesomeIcon icon={faAngleDown} />}
            >
              <Typography variant="h5" fontSize={16}>
                <HighlightSearchTerms text={article.title} />
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <ArticleComponent article={article} />
            </AccordionDetails>
          </Accordion>
        </div>
      ))}
    </>
  );
}

function ClusterLocations({ cluster }: { cluster: Cluster }) {
  const t = useTranslations("ClusterLocations");
  if (!cluster?.locations) return;
  const locations = cluster.locations.filter(
    (l) => Boolean(l.location) && typeof l.location === "string",
  );
  return (
    <ul className="mb-[10px] mt-[10px] flex list-none flex-wrap">
      {locations.map((l, i) => (
        <li key={`loc_${i}`} className="m-1 p-0">
          <Location
            title={!isLocationValid(l) ? t("invalid") : ""}
            status={isLocationValid(l) ? undefined : "invalid"}
          >
            {l.location}
          </Location>
        </li>
      ))}
      {locations.length === 0 && (
        <Location title={t("noLocationTitle")} status="missing">
          {t("noLocation")}
        </Location>
      )}
    </ul>
  );
}

function ClusterKeywords({ cluster }: { cluster: Cluster }) {
  const t = useTranslations("ClusterKeywords");
  const kbi =
    "kbi_keywords" in cluster ? (cluster.kbi_keywords as string[]) : [];
  const mmr =
    "mmr_keywords" in cluster ? (cluster.mmr_keywords as string[]) : [];
  if (kbi.length + mmr.length === 0) return;
  return (
    <section className="mt-2">
      <Typography variant="h3" fontSize={15}>
        {t("keywords")}
      </Typography>
      <ul className="mb-[10px] mt-[10px] flex list-none flex-wrap border-t">
        {kbi.map((l, i) => (
          <li key={`loc_${i}`} className="m-[2px] border border-black p-[2px]">
            {l}
          </li>
        ))}
        {mmr.map((l, i) => (
          <li key={`loc_${i}`} className="m-[2px] border border-gray-300 bg-gray-100 p-[2px]">
            {l}
          </li>
        ))}
      </ul>
    </section>
  );
}

const groupByOptions = ["", "pub_name", "pub_time", "pub_date"] as const;

type GroupByOptions = (typeof groupByOptions)[number];

export function ClusterView(
  props:
    | {
        cluster: Cluster;
        ogma?: OgmaLib;
      }
    | {
        cluster: Cluster;
        ogma?: OgmaLib;
        details: boolean;
        activeTab: ClusterNodeSection;
      },
) {
  const { cluster, ogma } = props;
  const details = "details" in props && props.details;
  const activeTab = "activeTab" in props && props.activeTab;

  const [question, setQuestion] = useState("");
  const endOfQARef = useRef<HTMLSpanElement | null>(null);
  const [groupArticlesBy, setGroupArticlesBy] = useState<GroupByOptions>("");
  const [tab, setTab] = useState(0);
  const [showLocate, setShowLocate] = useState(
    Boolean(
      Boolean(ogma && !ogma.geo.enabled()) ||
        (cluster?.locations &&
          cluster.locations.filter((l) => isLocationValid(l)).length > 0),
    ),
  );

  const t = useTranslations("ClusterView");

  const { qa, addQA, feature_GroupArticleBy, searchMatches, persona } =
    useStore();

  const [articles, setArticles] = useState<Article[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (ogma) {
      const geoEvent = () => {
        setShowLocate(
          Boolean(
            !ogma.geo.enabled() ||
              (cluster?.locations &&
                cluster.locations.filter((l) => isLocationValid(l)).length > 0),
          ),
        );
      };
      ogma.events.on(["geoDisabled", "geoEnabled"], geoEvent);
      geoEvent();
      return () => {
        ogma.events.off(geoEvent);
      };
    }
  }, [cluster?.locations, ogma]);

  useEffect(() => {
    if (activeTab === false || activeTab === "summary") {
      setTab(0);
    } else setTab(1);
  }, [activeTab]);

  const clusterQuery = api.post.cluster.useMutation();
  const questionApi = api.post.question.useMutation();

  useEffect(() => {
    const fetchCluster = async () => {
      if (cluster && details) {
        setIsFetching(true);
        const d = await clusterQuery.mutateAsync({
          id: getDataId(cluster),
          persona,
        });
        setArticles(
          d.nodes
            .filter(
              (n: RawNode<AllDataTypes>) =>
                getRawNodeData(n)?.type === "article",
            )
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
            ),
        );
        setIsFetching(false);
      }
    };
    void fetchCluster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cluster, details, persona]);

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

  const handleTabChange = useCallback(
    (evt: React.SyntheticEvent, newTab: number) => {
      setTab(newTab);
    },
    [],
  );

  const groupedArticles = useMemo(() => {
    if (groupArticlesBy !== "" && feature_GroupArticleBy) {
      return d3.group(
        d3.sort(articles, (a, b) => {
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
        <div className="pl-[30px] pr-[12px] pt-[10px]">
          <Title data={cluster} showLocate={showLocate} ogma={ogma} />
        </div>
        <Tabs
          value={tab}
          className="h-[42px] pl-[30px]"
          onChange={handleTabChange}
          centered
          variant="fullWidth"
        >
          <Tab
            className="sdp-summary-tab"
            sx={{ fontSize: 14 }}
            label={t("summary")}
          />
          <Tab
            sx={{ fontSize: 14 }}
            label={
              <div className="flex items-center space-x-2">
                <span>{t("articles")}</span>
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
                  <ClusterLocations cluster={cluster} />
                  {persona === "tom" && (
                    <section>
                      <ClusterKeywords cluster={cluster} />
                    </section>
                  )}
                  <section>
                    <Typography variant="body1" fontSize={14}>
                      <HighlightSearchTerms text={cluster.summary ?? ""} />
                    </Typography>
                  </section>
                  {persona !== "tom" && (
                    <section className="mt-[10px] border-t pt-[10px]">
                      <Typography variant="h5" fontSize={16} fontWeight={500}>
                        {t("questions")}
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
                  )}
                </div>
              </div>
            </div>
            {persona !== "tom" && (
              <div className="sdp-chat-console flex flex-col border-t pb-[12px] pl-[30px] pr-[10px] pt-[16px]">
                <TextField
                  InputLabelProps={{ sx: { fontSize: 16 } }}
                  variant="outlined"
                  label={t("chat.label")}
                  placeholder={t("chat.placeholder")}
                  onKeyUp={handleQuestion}
                  onChange={handleQuestionChange}
                  value={question}
                  InputProps={{
                    sx: { fontSize: 16 },
                    startAdornment: <InputAdornment position="start" />,
                  }}
                />
              </div>
            )}
          </>
        )}
        {tab === 1 && (
          <div className="h-0 flex-auto flex-col space-y-[8px] overflow-y-scroll pl-[30px] pr-[12px] pt-[12px]">
            <div className="flex flex-col space-y-[12px]">
              {feature_GroupArticleBy && (
                <div>
                  <FormControl sx={{ minWidth: 120 }} fullWidth>
                    <InputLabel
                      id="group_articles_by_select"
                      sx={{ fontSize: 14 }}
                    >
                      {t("groupBy")}
                    </InputLabel>
                    <Select
                      sx={{ fontSize: 14 }}
                      labelId="group_articles_by_select"
                      value={groupArticlesBy}
                      label={t("groupBy")}
                      onChange={handleGroupArticleByChange}
                    >
                      <MenuItem sx={{ fontSize: 14 }} value="">
                        <em>{t("noGrouping")}</em>
                      </MenuItem>
                      <MenuItem sx={{ fontSize: 14 }} value="pub_name">
                        {t("publication")}
                      </MenuItem>
                      <MenuItem sx={{ fontSize: 14 }} value="pub_time">
                        {t("pubTime")}
                      </MenuItem>
                      <MenuItem sx={{ fontSize: 14 }} value="pub_date">
                        {t("pubDate")}
                      </MenuItem>
                    </Select>
                  </FormControl>
                </div>
              )}
            </div>
            {groupedArticles === null && (
              <div className="flex flex-col">
                <ArticleList articles={articles} />
              </div>
            )}
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
      <Title data={cluster} showLocate={showLocate} ogma={ogma} />
      <ClusterLocations cluster={cluster} />
      <Typography variant="body1" fontSize={16}>
        <HighlightSearchTerms text={cluster.summary ?? ""} />
      </Typography>
    </section>
  );
}
