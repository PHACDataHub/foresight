/* eslint-disable */
// @ts-nocheck

import * as d3 from "d3";

// d3-based simple timline UI
const MS_IN_HOUR = 1000 * 1000 * 60 * 60;

const getSize = container => {
  const width = container.offsetWidth - 20;
  const height = container.offsetHeight;
  return { width: width, height: height };
};

export class TimeFilter {
  constructor(container, update) {
    const id = 'time-filter';
    this._container =
      document.getElementById(id) || document.createElement('div');
    this._container.id = id;

    this._update = update;

    window.addEventListener('resize', () => {
      return this._updateSize();
    });
    container.appendChild(this._container);
  }

  _updateSize() {
    const ref = getSize(this._container);
    const width = ref.width;
    const height = ref.height;
    d3.select('svg').attr('width', width).attr('height', height);
  }

  init(appState) {
    this._container.innerHTML = '<svg></svg>';
    const ref = getSize(this._container);
    const width = ref.width;
    const height = ref.height;
    const buckets = this._buckets;

    const svg = d3.select('svg');
    const margin = { top: 0, right: 0, bottom: 0, left: 0 };
    const g = svg
      .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    svg.attr('width', width).attr('height', height + 30);

    const min = buckets[0].start;
    const max = buckets[buckets.length - 1].end;

    const minValue = 0;
    const maxValue = buckets.reduce((a, b) => {
      return Math.max(a, b.value);
    }, 0);

    const x = d3.scaleLinear().domain([min, max]).range([0, width]);

    const y = d3.scaleLinear().domain([0, maxValue]).range([height, 0]);

    const brushed = extent => {
      extent = extent;
      const ids = [];
      let start = Infinity,
        end = -Infinity;
      bar.classed('selected', d => {
        const inside = extent[0] <= d.start && d.end <= extent[1];
        if (inside) {
          start = Math.min(start, d.start);
          end = Math.max(end, d.end);
        }
        return inside;
      });
      appState.timeFilter = [start, end];
      this._update();
    };

    const brush = d3
      .brushX()
      .extent([
        [0, 0],
        [width, height]
      ])
      .on('start brush', brushed);

    const barWidth = width / buckets.length;

    const bar = g
      .selectAll('g')
      .data(buckets)
      .enter()
      .append('g')
      .attr('transform', (d, i) => {
        return 'translate(' + i * barWidth + ',0)';
      });

    bar
      .append('rect')
      .attr('y', d => {
        return y(d.value);
      })
      .attr('height', d => {
        return height - y(d.value);
      })
      .attr('width', barWidth)
      .attr('class', 'bar');

    const beforebrushed = (event) => {
      event.stopImmediatePropagation();
      d3.select(this.parentNode).transition().call(brush.move, x.range());
    };

    g.append('g')
      .call(brush)
      .call(brush.move, [min + MS_IN_HOUR, max - MS_IN_HOUR].map(x))
      .selectAll('.overlay')
      .on('mousedown touchstart', beforebrushed, true);

    g.append('g')
      .attr('transform', 'translate(0,' + height + ')')
      .call(
        d3.axisBottom(x).tickFormat(d => {
          const date = new Date(d);
          return date.getHours() + ':' + date.getMinutes();
        })
      );

    brushed([buckets[0].end, buckets[buckets.length - 1].start]);
  }

  update(edges, appState) {
    let start = edges[0].date;
    let next = start + MS_IN_HOUR;
    let value = 0;

    const buckets = [
      {
        start: edges[0].date - MS_IN_HOUR,
        end: edges[0].date,
        next: next,
        value: value
      }
    ];
    edges.forEach((e, i) => {
      while (e.date > next) {
        // store
        buckets.push({ start: start, end: next, value: value });
        // reset
        start = next;
        next = start + MS_IN_HOUR;
        value = 0;
      }
      value += e.query_bytes || 0;
    });
    if (value !== 0) {
      buckets.push({ start: start, end: next, value: value });
    }

    buckets.push({ start: next, end: next + MS_IN_HOUR, next: 0, value: 0 });

    this._buckets = buckets;
    this.init(appState);
  }
}
