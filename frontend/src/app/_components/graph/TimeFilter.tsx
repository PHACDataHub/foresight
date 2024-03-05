import { useOgma } from "@linkurious/ogma-react";
import { useEffect, useRef } from "react";
import { TimeFilter } from "./timefilter";

export default function TimeFilterComponent() {
  const ogma = useOgma();
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current !== null) {
      new TimeFilter(ref.current, () => {
        console.log("ready?");
      }).update(ogma.getEdges("raw"));
    } else {
      console.error("oops");
    }
  }, [ogma]);

  return (
    <div className="absolute left-0 top-0" ref={ref}>
      Hello
    </div>
  );
}
