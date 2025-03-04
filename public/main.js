const { min } = require("d3-array");

function createLineChart() {
    d3.csv('SPX.csv').then(function(data) {
        data.forEach(function(d) {
            d.Date = d3.timeParse('%Y-%m-%d')(d.Date);
            d['Close'] = parseFloat(d['Close'].replace(',', ''));
        });

        const width = 1100;
        const height = 550;
        const margin = { top: 40, right: 30, bottom: 60, left: 80 };

        const minDate = d3.min(data, d => d.Date);
        const maxDate = d3.max(data, d => d.Date);

        const svg = d3.create('svg')
            .attr('width', width)
            .attr('height', height)
            .on("pointerenter pointermove", pointermoved)
            .on("pointerleave", pointerleft);

        const x = d3.scaleTime()
            .domain([minDate, maxDate]) 
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([d3.min(data, d => d['Close']), d3.max(data, d => d['Close'])])
            .nice()
            .range([height - margin.bottom, margin.top]);

        const line = d3.line()
            .x(d => x(d.Date))
            .y(d => y(d['Close']));

        const path = svg.append('path')
            .data([data])
            .attr('class', 'line')
            .attr('d', line);

        svg.append('text')
            .attr('x', width / 2)
            .attr('y', margin.top - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '18px')
            .attr('font-weight', 'bold')
            .text('S&P 500 Price Movement');

        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(8))
            .selectAll('text')
            .style('font-size', '14px'); 

        svg.append("text")     
            .attr("x", width / 2)
            .attr("y", height)
            .style("text-anchor", "middle")
            .text("Date");
            
        svg.append('g')
            .attr('class', 'y-axis')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(d3.axisLeft(y))
            .selectAll('text')
            .style('font-size', '14px'); 
        
        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y",  margin.left - 75)
            .attr("x", -(height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text("Closing Price $ (USD)");

        document.getElementById('chart-container').appendChild(svg.node());

        document.getElementById('start-date').value = d3.timeFormat('%Y-%m-%d')(minDate);
        document.getElementById('end-date').value = d3.timeFormat('%Y-%m-%d')(maxDate);

        function updateChart() {
            let startDate = d3.timeParse('%Y-%m-%d')(document.getElementById('start-date').value);
            let endDate = d3.timeParse('%Y-%m-%d')(document.getElementById('end-date').value);

            if (endDate < startDate) {
                endDate = maxDate;
                alert("Start Date must be before the End Date. Resetting chart.")
                document.getElementById('start-date').value = d3.timeFormat('%Y-%m-%d')(minDate);
                document.getElementById('end-date').value = d3.timeFormat('%Y-%m-%d')(maxDate);
            }

            if (startDate < minDate) {
                alert("Data ranges from Jan 1928 - Oct 2020. Setting start date to valid date.")
                document.getElementById('start-date').value = d3.timeFormat('%Y-%m-%d')(minDate);
                startDate = minDate
            }

            if (endDate > maxDate) {
                alert("Data ranges from Jan 1928 - Oct 2020. Setting end date to valid date.")
                document.getElementById('end-date').value = d3.timeFormat('%Y-%m-%d')(maxDate);
                endDate = maxDate
            }
            
            const filteredData = data.filter(d => d.Date >= startDate && d.Date <= endDate);

            x.domain([startDate, endDate]).nice();

            y.domain([d3.min(filteredData, d => d['Close']), d3.max(filteredData, d => d['Close'])]).nice();

            path.datum(filteredData)
                .attr('d', line);

            svg.select('.x-axis')
                .transition()
                .duration(500)
                .call(d3.axisBottom(x))
                .style('font-size', '14px');

            svg.select('.y-axis')
                .transition()
                .duration(500)
                .call(d3.axisLeft(y))
                .style('font-size', '14px');
        }

        const tooltip = svg.append("g");

        function formatValue(value) {
            return value.toLocaleString("en", {
              style: "currency",
              currency: "USD"
            });
        }
          
        function formatDate(date) {
            return date.toLocaleString("en", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC"
            });
        }

        const bisect = d3.bisector(d => d.Date).center;
        function pointermoved(event) {
            const i = bisect(data, x.invert(d3.pointer(event)[0]));
            tooltip.style("display", null);
            tooltip.attr("transform", `translate(${x(data[i].Date)},${y(data[i].Close)})`);
        
            const path = tooltip.selectAll("path")
                .data([,])
                .join("path")
                .attr("fill", "white")
                .attr("stroke", "black");
        
            const text = tooltip.selectAll("text")
                .data([,])
                .join("text")
                .call(text => text
                    .selectAll("tspan")
                    .data([formatDate(data[i].Date), formatValue(data[i].Close)])
                    .join("tspan")
                    .attr("x", 0)
                    .attr("y", (_, i) => `${i * 1.1}em`)
                    .attr("font-weight", (_, i) => i ? null : "bold")
                    .text(d => d));
        
            size(text, path);
        }
        
        function pointerleft() {
            tooltip.style("display", "none");
        }

        function size(text, path) {
            const {x, y, width: w, height: h} = text.node().getBBox();
            text.attr("transform", `translate(${-w / 2},${15 - y})`);
            path.attr("d", `M${-w / 2 - 10},5H-5l5,-5l5,5H${w / 2 + 10}v${h + 20}h-${w + 20}z`);
        }

        document.getElementById('date-change').addEventListener('click', updateChart);
    });
}

