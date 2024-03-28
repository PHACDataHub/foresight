"use client";

/**
 * Component used to display the current date as a locale string.
 */

import { useParams } from "next/navigation";
import React from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import Typography from "@mui/material/Typography";

import useDateToStr from "~/app/_hooks/useDateToStr";

import "react-datepicker/dist/react-datepicker.css";

type TimeTravelProps = {
  date?: Date;
  startDate?: Date;
  endDate?: Date;
  messages?: {
    todayIs?: string;
  };
};

function TodayIsComponent({
  date = new Date(2019, 11, 1, 12),
  messages,
}: TimeTravelProps) {
  const { locale } = useParams();

  const dateToStr = useDateToStr(locale);

  return (
    <Typography variant="subtitle1" fontSize={16} className="whitespace-nowrap">
      {messages?.todayIs ?? "title"} {dateToStr(date)}
    </Typography>
  );
}

function fallbackRender({ error }: FallbackProps) {
  const message: string = (error as Error).message;

  return (
    <div role="alert" data-testid="errorboundary">
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{message}</pre>
    </div>
  );
}

export default function TodayIs(props: TimeTravelProps) {
  return (
    <ErrorBoundary fallbackRender={fallbackRender}>
      <TodayIsComponent {...props} />
    </ErrorBoundary>
  );
}
