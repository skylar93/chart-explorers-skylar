const { min } = require("d3-array");

function createLineChart() {
    Promise.all([
        d3.csv('SPX.csv'),
        d3.csv('interest_rate.csv')
    ]).then(function([data1, data2]) {
        data1.forEach(function(d1) {
            d1.Date = d3.timeParse('%Y-%m-%d')(d1.Date);
            d1['Close'] = parseFloat(d1['Close'].replace(',', ''));
        });

        data2.forEach(function(d2) {
            d2.Date = d3.timeParse('%Y-%m-%d')(d2.Year + "-" + d2.Month + "-" + d2.Day);
            d2['Effective Federal Funds Rate'] = parseFloat(d2['Effective Federal Funds Rate'].replace(',', ''));
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

        const y1 = d3.scaleLinear()
            .domain([d3.min(data1, d1 => d1['Close']), d3.max(data1, d1 => d1['Close'])])
            .nice()
            .range([height - margin.bottom, margin.top]);

        const y2 = d3.scaleLinear()
            .domain([d3.min(data2, d2 => d2['Effective Federal Funds Rate']), d3.max(data2, d2 => d2['Effective Federal Funds Rate'])])
            .nice()
            .range([height - margin.bottom, margin.top]);

        const line = d3.line()
            .x(d1 => x(d1.Date))
            .y(d1 => y1(d1['Close']));

        const barWidth = 2;
        const bars = svg.selectAll('rect')
            .data(data2)
            .append('rect')
            .attr('x', d2 => x(d2.Date) - barWidth / 2)
            .attr('y', d2 => y2(d2['Effective Federal Funds Rate']))
            .attr('width', barWidth)
            .attr('height', d2 => height - margin.bottom - y2(d2['Effective Federal Funds Rate']))
            .attr('fill', 'orange');

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
            .call(d3.axisLeft(y1))
            .selectAll('text')
            .style('font-size', '14px'); 
        
        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", margin.left - 75)
            .attr("x", -(height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text("Closing Price $ (USD)");

        svg.append('g')
            .attr('class', 'y-axis')
            .attr('transform', `translate(${width - margin.right}, 0)`)
            .call(d3.axisRight(y2))
            .selectAll('text')
            .style('font-size', '14px'); 

        svg.append("text")
            .attr("transform", "rotate(90)")
            .attr("y", width - margin.right + 40)
            .attr("x", height / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text("Interest Rate (%)");

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
                alert("Data ranges from Jul 1954 - Mar 2017. Setting start date to valid date.")
                document.getElementById('start-date').value = d3.timeFormat('%Y-%m-%d')(minDate);
                startDate = minDate
            }

            if (endDate > maxDate) {
                alert("Data ranges from Jan 1954 - Mar 2017. Setting end date to valid date.")
                document.getElementById('end-date').value = d3.timeFormat('%Y-%m-%d')(maxDate);
                endDate = maxDate
            }
            
            const filteredData1 = data1.filter(d1 => d1.Date >= startDate && d1.Date <= endDate);
            const filteredData2 = data2.filter(d2 => d2.Date >= startDate && d2.Date <= endDate);

            x.domain([startDate, endDate]).nice();
            y1.domain([d3.min(filteredData1, d1 => d1['Close']), d3.max(filteredData1, d1 => d1['Close'])]).nice();
            y2.domain([d3.min(filteredData2, d2 => d2['Effective Federal Funds Rate']), d3.max(filteredData2, d2 => d2['Effective Federal Funds Rate'])]).nice();

            path.datum(filteredData1)
                .attr('d', line);

            bars.data(filteredData2)
                .transition()
                .duration(500)
                .attr('x', d2 => x(d2.Date) - barWidth / 2)
                .attr('y', d2 => y2(d2['Effective Federal Funds Rate']))
                .attr('height', d2 => height - margin.bottom - y2(d2['Effective Federal Funds Rate']));

            svg.select('.x-axis')
                .transition()
                .duration(500)
                .call(d3.axisBottom(x))
                .style('font-size', '14px');

            svg.select('.y-axis')
                .transition()
                .duration(500)
                .call(d3.axisLeft(y1))
                .style('font-size', '14px');

            svg.select('.y-axis')
                .transition()
                .duration(500)
                .call(d3.axisRight(y2))
                .style('font-size', '14px');
        }

        document.getElementById('date-change').addEventListener('click', updateChart);
    });
}
