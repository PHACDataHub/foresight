import { useOgma } from "@linkurious/ogma-react";
import { useEffect, useMemo, useState } from "react";

interface ProgressbarOptions {
  /** Gauge radius */
  radius?: number;
  /** Text to display. Default "progress" */
  text?: string;
  /** CSS class name. Default "progressbar" */
  className?: string;
  /** Total amount of nodes and edges */
  totalSize?: number;
  /** Number from 0 to 100 */
  percent?: number;
  /** show percentage */
  showPercent?: boolean;
}

export default function ProgressBar({
  radius = 70,
  text = "Progress",
  className = "ogmaprogressbar",
  totalSize = 100,
  percent: overridePercent,
  showPercent = true,
}: ProgressbarOptions = {}) {
  const ogma = useOgma();
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    if (typeof overridePercent === "number") setPercent(overridePercent);
  }, [overridePercent]);

  useEffect(() => {
    const onProgress = () => {
      const currentSize = ogma.getNodes().size + ogma.getEdges().size;
      setPercent((currentSize / totalSize) * 100);
    };

    ogma.events.on(["addNodes", "addEdges"], onProgress);

    return () => {
      ogma.events.off(onProgress);
    };
  }, [ogma, totalSize]);

  const strokeDashoffset = useMemo(() => {
    if (percent >= 0 && percent <= 100) {
      const c = radius * 2 * Math.PI;
      return c - (c * percent) / 100;
    }
  }, [radius, percent]);

  return (
    <div className={`${className}`}>
      <div className={`${className}--card`}>
        <div className={`${className}--box`}>
          <div className={`${className}--percent`}>
            <svg className={`${className}--indicator`}>
              <circle
                className={`${className}--circle`}
                cx={`${radius}`}
                cy={`${radius}`}
                r={`${radius}`}
              />
              <circle
                className={`${className}--circle ${className}--progress`}
                style={{ strokeDashoffset }}
                cx={`${radius}`}
                cy={`${radius}`}
                r={`${radius}`}
              />
            </svg>
            <div className={`${className}--num`}>
              {showPercent && (
                <h2>
                  {percent.toFixed(2)}
                  <span>%</span>
                </h2>
              )}
            </div>
          </div>
          <h2 className={`${className}--text`}>{text}</h2>
        </div>
      </div>
    </div>
  );
}

export class Progressbar {
  private _container: HTMLElement;
  private _text: HTMLElement;
  private _num: HTMLElement;
  private _progress: SVGCircleElement;
  private _circumference: number;

  /**
   * @param {object} options
   * @param {number} options.radius=70 Gauge radius
   * @param {string} options.text="Progress" Text to display
   * @param {string} className="progressbar"
   */
  constructor({
    radius = 70,
    text = "Progress",
    className = "progressbar",
  }: ProgressbarOptions = {}) {
    this._container = this._renderTemplate({ text, radius, name: className });
    this._text = this._container.querySelector(`.${className}--text`)!;
    this._num = this._container.querySelector(`.${className}--num`)!;
    this._progress = this._container.querySelector(`.${className}--progress`)!;
    this._circumference = radius * 2 * Math.PI;
  }

  /**
   * Show the progressbar above all other UI
   */
  show() {
    document.body.appendChild(this._container);
    return this;
  }

  /**
   * Remove the progressbar from the DOM
   */
  hide() {
    try {
      document.body.removeChild(this._container);
    } catch {}
    return this;
  }

  /**
   * @param percent Number between 0 and 100
   */
  setValue(percent: number) {
    if (percent >= 0 && percent <= 100) {
      const c = this._circumference;
      const value = c - (c * percent) / 100;
      this._progress.style.strokeDashoffset = value.toString();
      this._num.innerHTML = `<h2>${percent.toFixed(2)}<span>%</span></h2>`;
    }
    return this;
  }

  /**
   * @param text
   * @returns
   */
  setText(text: string) {
    this._text.innerText = text;
    return this;
  }

  private _renderTemplate({
    text,
    radius,
    name,
  }: {
    text: string;
    radius: number;
    name: string;
  }) {
    const container = document.createElement("div");
    container.className = name;
    container.innerHTML = `
        <div class="${name}--card">
          <div class="${name}--box">
            <div class="${name}--percent">
              <svg class="${name}--indicator">
                <circle
                  class="${name}--circle"
                  cx="${radius}"
                  cy="${radius}"
                  r="${radius}" />
                <circle
                  class="${name}--circle ${name}--progress"
                  cx="${radius}"
                  cy="${radius}"
                  r="${radius}" />
              </svg>
              <div class="${name}--num">
                <h2>0<span>%</span></h2>
              </div>
            </div>
            <h2 class="${name}--text">${text}</h2>
          </div>
        </div>
      `;
    return container;
  }
}
