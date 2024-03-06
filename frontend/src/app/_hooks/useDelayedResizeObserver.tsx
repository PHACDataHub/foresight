"use client";

import { useEffect, useState } from "react";

const TICK_SPEED = 100;

export default function useDelayedResizeObserver(
  elementId: string,
  timeout = 5,
) {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const newHeight = entry?.borderBoxSize[0]?.blockSize;
      if (newHeight) setHeight(newHeight);
    });

    let count = 0;
    const findElement = () => {
      setTimeout(() => {
        count += TICK_SPEED;
        const element = document.getElementById(elementId);
        if (!element) {
          console.log(`${elementId} - ${count}`);
          if (timeout > 0 && count > timeout * 1000) {
            throw new Error(`Unable to locate element with id ${elementId}.`);
          }
          findElement();
        } else {
          observer.observe(element, { box: "border-box" });
        }
      }, TICK_SPEED);
    };
    findElement();
    return () => {
      observer.disconnect();
    };
  }, [elementId, timeout]);

  return height;
}
