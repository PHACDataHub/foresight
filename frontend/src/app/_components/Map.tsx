"use client";

import { useEffect, useRef } from "react";
import Plot from "react-plotly.js";

const test =
  `code,state,category,total exports,beef,pork,poultry,dairy,fruits fresh,fruits proc,total fruits,veggies fresh,veggies proc,total veggies,corn,wheat,cotton
CAN,Canada,state,1794.57,58.80,1.40,14.20,63.66,100.70,214.40,315.04,48.20,78.30,126.50,11.70,320.30,0.00
AUS,Australia,state,10969.87,50.90,91.30,169.80,280.87,28.60,60.90,89.48,14.60,23.70,38.26,112.10,41.00,0.00
EGY,Egypt,state,180.14,6.20,0.20,0.90,65.98,2.60,5.40,8.01,1.50,2.50,4.05,0.00,0.00,0.00
CHN,China,state,17000.81,59.20,0.00,35.60,154.18,555.60,1183.00,1738.57,138.70,225.10,363.79,29.50,786.30,0.00
`.split("\n");

const keys = test[0]?.split(",");
const rows: object[] = [];
if (keys) {
  for (let x = 1; x < test.length; x += 1) {
    const data = test[x]?.split(",");
    if (data && data.length === keys.length) {
      rows.push(Object.fromEntries(keys.map((k, i) => [k, data[i] ?? ""])));
    }
  }
}

// @ts-expect-error just testing
const unpack = (key: string) => rows.map((r) => r[key] as string);

export default function Map({ geojson }: { geojson: object }) {
  const container = useRef<HTMLDivElement>(null);
  // const [width, setWidth] = useState(0);
  // const [height, setHeight] = useState(0);
  useEffect(() => {
    if (container.current) {
      // setWidth(container.current.clientWidth);
      // setHeight(container.current.clientHeight);
    }
  }, [container]);
  return (
    <div className="h-full w-full border-2 border-black" ref={container}>
      <Plot
        useResizeHandler
        className="w-hull h-full border-2 border-red-200"
        // style={{ height, width }}
        data={[
          {
            type: "choropleth",
            locationmode: "geojson-id",
            locations: unpack("code"),
            // @ts-expect-error testing
            geo: "geo1",
            geojson,
            featureidkey: "properties.iso_a3",

            z: unpack("total exports"),
            text: unpack("state"),
            zmin: 0,
            zmax: 17000,
            colorscale: [
              [0, "rgb(242,240,247)"],
              [0.2, "rgb(218,218,235)"],
              [0.4, "rgb(188,189,220)"],
              [0.6, "rgb(158,154,200)"],
              [0.8, "rgb(117,107,177)"],
              [1, "rgb(84,39,143)"],
            ],
            showscale: false,
            showlegend: false,
            marker: {
              line: {
                color: "rgb(255,255,255)",
                width: 2,
              },
            },
          },
        ]}
        layout={{
          // title: "A Fancy Plot",
          // width,
          // height,
          geo: {
            scope: "world",
            resolution: 110,
            //   geojson,
            //   projection: { type: "mercator" },

            //   showrivers: false,
            //   rivercolor: '#fff',

            // showlakes: false,
            // lakecolor: "#aaf",

            //   lataxis: { range: [45, 80] },
            //   lonaxis: { range: [-130, -55] },

            // showland: true,
            // landcolor: "#fff",

            // showsubunit: true,
            // subunitcolor: "#ccc",
            // subunitwidth: 0.5,
            // showcountry: true,
            // countrycolor: "#ccc",
            // countrywidth: 1,
          },
        }}
      />
    </div>
  );
}
