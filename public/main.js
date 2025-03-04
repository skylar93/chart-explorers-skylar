const { min } = require("d3-array");

function createLineChart() {
    Promise.all([
        d3.csv('SPX.csv'),
        d3.csv('interest_rate.csv')
    ]).then(function([data1, data2]) {
        data1.forEach(function(d) {
            d.Date = d3.timeParse('%Y-%m-%d')(d.Date);
            d['Close'] = parseFloat(d['Close'].replace(',', ''));
        });

        data2.forEach(function(d) {
            d.Date = d3.timeParse('%Y-%m-%d')(d.Year + "-" + d.Month + "-" + d.Day);
            d['Close'] = parseFloat(d['Close'].replace(',', ''));
        });

        const width = 800;
        const height = 400;
        const margin = { top: 40, right: 30, bottom: 60, left: 80 };

        const minDate = d3.timeParse('%Y-%m-%d')('1954-07-01');
        const maxDate = d3.timeParse('%Y-%m-%d')('2017-03-16');

        const svg = d3.create('svg')
            .attr('width', width)
            .attr('height', height)
            .on("pointerenter pointermove", pointermoved)
            .on("pointerleave", pointerleft);

        document.getElementById('chart-container').appendChild(svg.node());

        const x = d3.scaleTime()
            .domain([minDate, maxDate]) 
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([d3.min(data1, d => d['Close']), d3.max(data1, d => d['Close'])])
            .nice()
            .range([height - margin.bottom, margin.top]);

        const line = d3.line()
            .x(d => x(d.Date))
            .y(d => y(d['Close']));

        const path = svg.append('path')
            .data([data1])
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
            
            const filteredData = data1.filter(d => d.Date >= startDate && d.Date <= endDate);

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

        document.getElementById('date-change').addEventListener('click', updateChart);
    });
}
