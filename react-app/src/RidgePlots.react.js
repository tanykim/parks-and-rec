/******
/* React Component: for Ridge Plots of National Parks visitors data
******/

import * as d3 from 'd3';
import _ from 'lodash';
import chroma from 'chroma-js';
import React, { Component } from 'react';
import Select from 'react-select';

// distance between two plots
const plotDist = 20;
const margin = {top: 20, right: 0, bottom: 40, left: 300};
const dim = {w: null, h: null};
// height of the selected park
const plotHeight = 240;
let maxY;
const detailH = 300;
const line = d3.line();

class RidgePlots extends Component {
  state = {sortOption: 'total-desc'};

  // resize the svg after reorder & park selection
  _resizeWrapperHeight() {
    d3.select('#ridge-plots')
      .attr('height', dim.h + margin.top + margin.bottom + maxY + (this.props.selections.length > 0 && detailH));
  }

  // show detailed vis of the selected park
  _showDetail(order, id) {
    // move down parks below the selected one
    d3.selectAll('.js-ridge-g')
      .attr('transform', function() {
        const o = +d3.select(this).attr('order');
        return `translate(${margin.left}, ${margin.top + maxY + (o > order ? detailH : 0) + (o * plotDist)})`
      });
    this._resizeWrapperHeight();
  }

  _dimParks(id) {
    d3.selectAll('.js-ridge-g')
      .filter(d => d !== id)
      .classed('dimmed', true)
      .selectAll('.js-ridge-outlines').attr('d', `M0,0h${dim.w}`);
  }

  // mouse actions only when no parks are selected
  _mouseOver(id) {
    this._dimParks(id);
    d3.select(`.js-ridge-outline-${id}`).classed('active', true);
  }
  _mouseOut(id) {
    d3.selectAll('.js-ridge-g')
      .classed('dimmed', false)
      .selectAll('.js-ridge-outlines').attr('d', line);
    d3.select(`.js-ridge-outline-${id}`).classed('active', false);
  }

  // when a park is selected
  _highlightPark(id, hasPrev) {
    !hasPrev && this._dimParks(id);
    d3.select(`.js-ridge-g-${id}`)
      .classed('dimmed', false)
      .classed('defocused', false);
    d3.select(`.js-ridge-outline-${id}`).attr('d', line).classed('active', true);
  }

  // when a new park is selected, defocus previously selected ones
  _defocus(id) {
    d3.select(`.js-ridge-g-${id}`)
      .classed('dimmed', false)
      .classed('defocused', true);
    d3.select(`.js-ridge-outline-${id}`)
      .attr('d', line)
      .classed('active', false);
  }

  // when a park is deselected (still there's a selected one)
  // reset to the dimmed status
  _reset = (id) => {
    d3.select(`.js-ridge-g-${id}`)
      .classed('dimmed', true)
      .classed('defocused', false);
    d3.select(`.js-ridge-outline-${id}`)
      .classed('active', false);
  }

  // revert to the normal status
  _revertToNormal = () => {
    // move up the parks below the previously selected park
    d3.selectAll('.js-ridge-g')
      .classed('dimmed', false)
      .classed('defocused', false)
      .attr('transform', function() {
        const order = +d3.select(this).attr('order');
        return `translate(${margin.left}, ${margin.top + plotHeight + (order * plotDist)})`;
      })
    d3.selectAll('.js-ridge-outlines').attr('d', line);
    // TOOD: fix the resize
    this._resizeWrapperHeight();
  }

  _drawParks() {
    const data = this.props.data;
    maxY = plotHeight;
    const svg = d3.select('#ridge-plots')
      .attr('width', dim.w + margin.left + margin.right)
      .attr('height', dim.h + margin.top + margin.bottom + plotHeight);

    // add two points on each side of X axis
    const x = d3.scaleLinear().range([0, dim.w]).domain([0, 15]);
    const maxMonthly = _.max(data.parks.map(d => _.max(d.by_month)));
    // since the y base is 0, do not swap range
    const y = d3.scaleLinear().range([0, plotHeight]).domain([0, maxMonthly]);
    line.x((d, i) => x(i)).y(d => -y(d));

    // fill the ridge graph with the size of the park
    const color = chroma.scale(['LightGoldenrodYellow', 'Green', 'DarkGreen'])
      .domain([data.min_size, data.max_size]);

    // sort the national parks
    const sorted = this._sortParks(data.parks, this.state.sortOption);
    for (let i in sorted) {
      const park = sorted[i];
      // wrapper
      const g = svg
        .append('g')
        .datum(park.id)
        .attr('order', i)
        .attr('transform', `translate(${margin.left}, ${margin.top + plotHeight + (+i * plotDist)})`)
        .attr('class', `ridge-g js-ridge-g js-ridge-g-${park.id}`)
        .on('mouseover', () => {
          this.props.selections.length === 0 && this._mouseOver(park.id);
        })
        .on('mouseout', () => {
          this.props.selections.length === 0 && this._mouseOut(park.id);
        })
        .on('click', () => {
          // select park if this park isn't selected
          if (this.props.selections.map(p => p.value).indexOf(park.id) === -1) {
            this.props.onSelectPark(park.id);
          } else {
            this.props.onUnselectPark(park.id);
          }
        });
      const c = color(park.size);
      let lineData = _.concat([0, 0], park.by_month, [0, 0]);
      let fillLine =  line(lineData).replace('M0,0', `M0,${plotDist}v${-plotDist}`) + `v${plotDist}`;
      // filling gap between two plots
      g.append('path')
        .attr('d', fillLine)
        .attr('fill', c)
        .attr('max', y(_.max(park.by_month)))
        .attr('class', `ridge-plot-fill js-ridge-fill js-ridge-fill-${park.id}`);
      g.append('path')
        .datum(lineData)
        .attr('d', line)
        .attr('max', y(_.max(park.by_month)))
        .attr('class', `ridge-plot-outline js-ridge-outlines js-ridge-outline-${park.id}`);
      // national park name
      g.append('text')
        .text(park.name.replace('National Park', 'NP').replace(' & Preserve', '&P'))
        .attr('x', 0)
        .attr('y', plotDist / 2)
        .attr('class', 'ridge-plot-name')
        .on('mouseover', function() {
          d3.select(this).classed('hover', true);
        })
        .on('mouseout', function() {
          d3.select(this).classed('hover', false);
        });
    }
  }

  _sortParks = (parks, optionVal) => {
    const option = optionVal.split('-');
    let sorted = _.orderBy(parks, d => d[option[0]]);
    sorted = option[1] === 'desc' ? sorted.reverse() : sorted;
    return sorted;
  }

  _onOptionChange = (sortOption) => {
    const optionVal = sortOption.value;
    // replacing place holder text
    this.setState({sortOption: optionVal});

    // sort the parks
    const sorted = this._sortParks(this.props.data.parks, optionVal);
    const parentNode = d3.select('#ridge-plots').node();
    // set the offset between margin top and the plot base)
    for (let i in sorted) {
      const val = +d3.select(`.js-ridge-outline-${sorted[i].id}`).attr('max');
      // check if the following parks height go over the maxY
      if (+i === 0) {
        maxY = val;
      } else if (Math.max(val, +i * plotDist) > maxY) {
        maxY = Math.max(maxY, val - +i * plotDist);
      }
    }
    // animate the vertical position of each park
    let hasSelectedPark = false;
    for (let j in sorted) {
      const park = sorted[j];
      const sel = d3.select(`.js-ridge-g-${park.id}`);
      // rearrange; bring front to the vis
      parentNode.appendChild(sel.node());
      const yPos = margin.top + maxY + (hasSelectedPark && detailH) + (+j * plotDist);
      // start animation
      sel.attr('order', j)
        .transition()
        .duration(1200)
        .attr('transform', `translate(${margin.left}, ${yPos})`);
      // keep distance if a park is selected
      if (this.props.selections.length > 0) {
        if (park.id === this.props.selections[this.props.selections.length - 1].value) {
          hasSelectedPark = true;
        }
      }
    }
    //resize the svg
    this._resizeWrapperHeight();
  }

  componentDidMount() {
    dim.w = this.props.getWidth('ridgePlots') - margin.left - margin.right;
    dim.h = this.props.data.parks.length * plotDist;
    this._drawParks();
  }

  componentWillReceiveProps(nextProps) {
    // when dataset is swtiched
    if (this.props.selections.length !== nextProps.selections.length) {
      // check if new park is selected
      if (nextProps.selections.length > this.props.selections.length) {
        // highlight the park
        const id = nextProps.selections[nextProps.selections.length - 1].value;
        this._highlightPark(id);
        this._showDetail(+d3.select(`.js-ridge-g-${id}`).attr('order'), id);
        // dehighlight the previous parks
        if (this.props.selections.length > 0) {
          for (let sel of this.props.selections) {
            this._defocus(sel.value);
          }
        }
      // if park(s) deselected
      } else {
        const current = this.props.selections.map(p => p.value);
        const next = nextProps.selections.map(p => p.value);
        const removedParks = _.difference(current, next);
        // still selected parks are remained
        if (next.length > 0 ) {
          for (let park of removedParks) {
            console.log('------removed', park);
            this._reset(park);
          }
          for (let i = 0; i < next.length - 1; i++) {
            console.log(next[i]);
            this._defocus(next[i]);
          }
          const id = next[next.length -1];
          this._highlightPark(id, true);
          this._showDetail(+d3.select(`.js-ridge-g-${id}`).attr('order'), id);
        } else {
          this._revertToNormal();
        }
      }
    }

  }

  render() {
    return (
      <div className="row ridge-plots">
        <div className="col-xs-12 col-md-6 col-md-offset-3 col-lg-4 col-lg-offset-4">
          <Select
            clearable={false}
            searchable={false}
            value={this.state.sortOption}
            placeholder="Sort parks by"
            onChange={this._onOptionChange}
            options = {[
              {label: 'Name: A to Z', value: 'name-asc'},
              {label: 'Name: Z to A', value: 'name-desc'},
              {label: 'Total visitors: large to small', value: 'total-desc'},
              {label: 'Total visitors: small to large', value: 'total-asc'},
              {label: 'Size: large to small', value: 'size-desc'},
              {label: 'Size: small to large', value: 'size-asc'},
              {label: 'Location: west to east', value: 'lon-asc'},
              {label: 'Location: east to west', value: 'lon-desc'},
              {label: 'Location: north to south', value: 'lat-desc'},
              {label: 'Location: south to north', value: 'lat-asc'},
            ]}
          />
        </div>
        <div className="col-xs-12">
          <svg id="ridge-plots" className="ridge-plots-wrapper"/>
        </div>
      </div>
    );
  }
}


export default RidgePlots;
