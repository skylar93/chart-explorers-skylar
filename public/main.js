function createLineChart() {
    const selectContainer = document.createElement('div');
    selectContainer.style.marginBottom = '10px';
    selectContainer.style.textAlign = 'center';
    
    const indicatorLabel = document.createElement('label');
    indicatorLabel.textContent = 'Select Indicator: ';
    indicatorLabel.style.marginRight = '10px';
    indicatorLabel.style.fontWeight = 'bold';
    
    const indicatorSelect = document.createElement('select');
    indicatorSelect.id = 'indicator-select';
    
    const options = [
        { value: 'interest', text: 'Interest Rate' },
        { value: 'unemployment', text: 'Unemployment Rate' },
        { value: 'inflation', text: 'Inflation Rate' }
    ];
    
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        indicatorSelect.appendChild(optionElement);
    });
    
    selectContainer.appendChild(indicatorLabel);
    selectContainer.appendChild(indicatorSelect);
    
    const chartContainer = document.getElementById('chart-container');
    chartContainer.parentNode.insertBefore(selectContainer, chartContainer);

    Promise.all([
        d3.csv('SPX.csv'),
        d3.csv('interest_rate.csv')
    ]).then(function([data1, data2]) {

        data1.forEach(function(d1) {
            d1.Date = d3.timeParse('%Y-%m-%d')(d1.Date);
            d1['Close'] = parseFloat(d1['Close'].replace(',', ''));
        });

        data2.forEach(function(d2) {
            const month = String(d2.Month).padStart(2, '0');
            const day = String(d2.Day).padStart(2, '0');
            
                // Construct the full date string
            d2.Date = d3.timeParse('%Y-%m-%d')(d2.Year + "-" + month + "-" + day);

            d2['Effective Federal Funds Rate'] = parseFloat(d2['Effective Federal Funds Rate'].replace(',', ''));
            
            if (d2['Unemployment Rate']) {
                d2['Unemployment Rate'] = parseFloat(d2['Unemployment Rate'].replace(',', ''));
            }
            if (d2['Inflation Rate']) {
                d2['Inflation Rate'] = parseFloat(d2['Inflation Rate'].replace(',', ''));
            }
        });
        
        const unemploymentData = data2
            .filter(d => d['Unemployment Rate'])
            .map(d => ({
                date: d.Date,
                value: d['Unemployment Rate']
            }));
            
        const inflationData = data2
            .filter(d => d['Inflation Rate'])
            .map(d => ({
                date: d.Date,
                value: d['Inflation Rate']
            }));
        
        window.extraData = {
            unemployment: unemploymentData,
            inflation: inflationData
        };
        
        const width = 900;
        const height = 400;
        const margin = { top: 40, right: 150, bottom: 60, left: 80 };
        
        const minDate = d3.timeParse('%Y-%m-%d')('1954-07-01');
        const maxDate = d3.timeParse('%Y-%m-%d')('2017-03-16');

        const initialData1 = data1.filter(d1 => d1.Date >= minDate && d1.Date <= maxDate);
        const initialData2 = data2.filter(d2 => d2.Date >= minDate && d2.Date <= maxDate);
        
        const initialUnemploymentData = initialData2
            .filter(d => d['Unemployment Rate'] !== undefined && 
                     !isNaN(d['Unemployment Rate']) && 
                     d['Unemployment Rate'] > 0 && 
                     d['Unemployment Rate'] < 20)
            .sort((a, b) => a.Date - b.Date);

        const inflationPropertyName = Object.keys(initialData2[0] || {})
            .find(key => key.toLowerCase().includes('inflation'));
            
        const initialInflationData = inflationPropertyName ? 
            initialData2
                .filter(d => {
                    const value = d[inflationPropertyName];
                    return value !== undefined && 
                           !isNaN(parseFloat(value)) &&
                           d.Date && !isNaN(d.Date.getTime());
                })
                .map(d => ({
                    Date: d.Date,
                    'Inflation Rate': parseFloat(d[inflationPropertyName])
                }))
                .sort((a, b) => a.Date - b.Date) : [];

        // Define bisect for tooltip
        const bisect = d3.bisector(d => d.Date).left;
        
        const svg = d3.create('svg')
            .attr('width', width)
            .attr('height', height);
            
        // Create tooltip div
        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background-color", "white")
            .style("border", "1px solid #ddd")
            .style("padding", "10px")
            .style("border-radius", "5px");
            
        // Add mouse events
        svg.on("mousemove", mousemove)
           .on("mouseleave", mouseleave);

        document.getElementById('chart-container').appendChild(svg.node());

        const x = d3.scaleTime()
            .domain([minDate, maxDate]) 
            .range([margin.left, width - margin.right]);

        // Create a function to update the scale
        function createScale(useLogScale) {
            if (useLogScale) {
                return d3.scaleLog()
                    .domain([Math.max(0.1, d3.min(initialData1, d => d['Close']) * 0.9), 
                            d3.max(initialData1, d => d['Close']) * 1.05])
                    .nice()
                    .range([height - margin.bottom, margin.top]);
            } else {
                return d3.scaleLinear()
                    .domain([d3.min(initialData1, d => d['Close']) * 0.95, 
                            d3.max(initialData1, d => d['Close']) * 1.05])
                    .nice()
                    .range([height - margin.bottom, margin.top]);
            }
        }

        let y1 = createScale(false);

        const y2 = d3.scaleLinear()
            .domain([0, d3.max(initialData2, d => d['Effective Federal Funds Rate']) * 1.1])
            .nice()
            .range([height - margin.bottom, margin.top]);
            
        const y3 = d3.scaleLinear()
            .domain([0, 20])
            .nice()
            .range([height - margin.bottom, margin.top]);
            
        const y4 = d3.scaleLinear()
            .domain([-2, 15])
            .nice()
            .range([height - margin.bottom, margin.top]);

        const line = d3.line()
            .x(d => x(d.Date))
            .y(d => y1(d['Close']))
            .defined(d => d['Close'] !== undefined && !isNaN(d['Close'])); // Skip undefined or NaN points
            
        const unemploymentLine = d3.line()
            .curve(d3.curveBasis)
            .defined(d => d['Unemployment Rate'] !== undefined && !isNaN(d['Unemployment Rate']))
            .x(d => x(d.Date))
            .y(d => y3(d['Unemployment Rate']));
            
        const inflationLine = d3.line()
            .x(d => x(d.Date))
            .y(d => y4(d['Inflation Rate']))
            .curve(d3.curveBasis);

        // Define recession periods
        const recessions = [
            {start: d3.timeParse('%Y-%m-%d')('1979-12-01'), end: d3.timeParse('%Y-%m-%d')('1980-07-31')},
            {start: d3.timeParse('%Y-%m-%d')('1981-07-01'), end: d3.timeParse('%Y-%m-%d')('1982-11-30')},
            {start: d3.timeParse('%Y-%m-%d')('1990-07-01'), end: d3.timeParse('%Y-%m-%d')('1991-03-31')},
            {start: d3.timeParse('%Y-%m-%d')('2001-03-01'), end: d3.timeParse('%Y-%m-%d')('2001-11-30')},
            {start: d3.timeParse('%Y-%m-%d')('2008-01-01'), end: d3.timeParse('%Y-%m-%d')('2009-06-30')},
            {start: d3.timeParse('%Y-%m-%d')('2020-02-01'), end: d3.timeParse('%Y-%m-%d')('2020-04-30')}
        ];
        
        // Log the recession periods for debugging
        console.log("Recession periods:", recessions.map(r => ({
            start: r.start, 
            end: r.end,
            inRange: r.start >= minDate && r.end <= maxDate
        })));
        
        recessions.forEach(recession => {
            if (recession.start && recession.end && 
                !isNaN(recession.start) && !isNaN(recession.end) &&
                recession.start >= minDate && recession.end <= maxDate) {
                
                const rectX = x(recession.start);
                const rectWidth = x(recession.end) - x(recession.start);
                const rectHeight = height - margin.top - margin.bottom;
                
                // Only draw if dimensions are valid
                if (!isNaN(rectX) && !isNaN(rectWidth) && rectWidth > 0 && rectHeight > 0) {
                    svg.append("rect")
                        .attr("class", "recession-zone")
                        .attr("x", rectX)
                        .attr("y", margin.top)
                        .attr("width", rectWidth)
                        .attr("height", rectHeight)
                        .attr("fill", "#CCCCCC")
                        .attr("opacity", 0.9);
                }
            }
        });
        
        svg.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x)
                .tickSize(-(height - margin.top - margin.bottom))
                .tickFormat('')
            )
            .selectAll('line')
            .style('stroke', '#eee');

        const barWidth = 2;
        const bars = svg.selectAll('rect.interest-bar')
            .data(initialData2.filter(d => 
                d['Effective Federal Funds Rate'] !== undefined && 
                !isNaN(d['Effective Federal Funds Rate']) &&
                d.Date && !isNaN(d.Date)
            ))
            .join('rect')
            .attr('class', 'interest-bar')
            .attr('x', d => x(d.Date) - barWidth / 2)
            .attr('y', d => y2(d['Effective Federal Funds Rate']))
            .attr('width', barWidth)
            .attr('height', d => {
                const barHeight = height - margin.bottom - y2(d['Effective Federal Funds Rate']);
                return isNaN(barHeight) || barHeight < 0 ? 0 : barHeight;
            })
            .attr('fill', 'orange');

        const path = svg.append('path')
            .datum(initialData1)
            .attr('class', 'line')
            .attr('fill', 'none')
            .attr('stroke', 'steelblue')
            .attr('stroke-width', 2)
            .attr('d', line);
            
        // Add unemployment line
        const unemploymentPath = svg.append('path')
            .datum(initialUnemploymentData)
            .attr('class', 'unemployment-line')
            .attr('fill', 'none')
            .attr('stroke', 'red')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,2')
            .attr('d', unemploymentLine);

         // 실제 인플레이션 데이터 시각화
        const inflationPath = svg.append('path')
            .datum(initialInflationData)
            .attr('class', 'inflation-line')
            .attr('fill', 'none')
            .attr('stroke', 'green')
            .attr('stroke-width', 1.5)
            .attr('d', inflationLine);
        
        // Simple tooltip implementation
        function mousemove(event) {
            const mouseX = d3.pointer(event)[0];
            const date = x.invert(mouseX);
            
            // Find the closest data point
            const index = d3.bisector(d => d.Date).left(initialData1, date);
            if (index >= initialData1.length) return;
            
            const d0 = initialData1[index - 1];
            const d1 = initialData1[index];
            
            if (!d0 || !d1) return;
            
            const d = date - d0.Date > d1.Date - date ? d1 : d0;
            
            tooltip.style("opacity", 0.9)
                .html(`<strong>Date:</strong> ${d3.timeFormat("%b %d, %Y")(d.Date)}<br/>` +
                       `<strong>S&P 500:</strong> $${d.Close.toFixed(2)}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        }
        
        function mouseleave() {
            tooltip.style("opacity", 0);
        }
            
        // Add log scale checkbox functionality
        document.getElementById('log-scale').addEventListener('change', function() {
            const useLogScale = this.checked;
            
            // Update the scale
            y1 = createScale(useLogScale);
            
            // Update the line function with new scale
            line.y(d => y1(d['Close']));
            
            // Update the path
            path.transition()
                .duration(500)
                .attr('d', line);
            
            // Update axes with smooth transitions
            svg.select(".x-axis")
                .transition()
                .duration(500)
                .call(d3.axisBottom(x))
                .style('font-size', '14px');
            
            svg.select(".y-axis")
                .transition()
                .duration(500)
                .call(d3.axisLeft(y1))
                .style('font-size', '14px');
        });

        document.getElementById('date-change').addEventListener('click', function() {
            updateChart(data1, data2, svg, x, y1, y2, line, bars, path, 
                       recessions, barWidth, height, margin, unemploymentPath, 
                       inflationPath, unemploymentLine, inflationLine);
        });
        
        document.getElementById('start-date').value = d3.timeFormat('%Y-%m-%d')(minDate);
        document.getElementById('end-date').value = d3.timeFormat('%Y-%m-%d')(maxDate);
        
        createCorrelationHeatmap(data1, data2);

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
            .attr("y", width - margin.right + 40)
            .attr("x", -(height / 2))
            .attr("dy", "1em")
            .attr("text-anchor", "middle")
            .text("Rate (%)");
        
        svg.append('g')
            .attr('class', 'y-axis-right')  // 클래스 이름 변경하여 충돌 방지
            .attr('transform', `translate(${width - margin.right}, 0)`)
            .call(d3.axisRight(y2))
            .selectAll('text')
            .style('font-size', '14px'); 

        // 범례 추가
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width - margin.right + 40}, ${margin.top-10})`);
        
        // S&P 500 범례
        legend.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 20)
            .attr("y2", 0)
            .style("stroke", "steelblue")
            .style("stroke-width", 2);
        
        legend.append("text")
            .attr("x", 25)
            .attr("y", 5)
            .text("S&P 500")
            .style("font-size", "12px");
        
        // 이자율 범례
        legend.append("rect")
            .attr("x", 0)
            .attr("y", 15)
            .attr("width", 20)
            .attr("height", 10)
            .style("fill", "orange");
        
        legend.append("text")
            .attr("x", 25)
            .attr("y", 25)
            .text("Interest Rate")
            .style("font-size", "12px");
        
        // 실업률 범례
        legend.append("line")
            .attr("x1", 0)
            .attr("y1", 40)
            .attr("x2", 20)
            .attr("y2", 40)
            .style("stroke", "red")
            .style("stroke-width", 2)
            .style("stroke-dasharray", "4,2");
        
        legend.append("text")
            .attr("x", 25)
            .attr("y", 45)
            .text("Unemployment")
            .style("font-size", "12px");
        
        // 인플레이션 범례
        legend.append("line")
            .attr("x1", 0)
            .attr("y1", 60)
            .attr("x2", 20)
            .attr("y2", 60)
            .style("stroke", "green")
            .style("stroke-width", 2);
        
        legend.append("text")
            .attr("x", 25)
            .attr("y", 65)
            .text("Inflation")
            .style("font-size", "12px");

        // 불경기 범례
        legend.append("rect")
            .attr("x", 0)
            .attr("y", 80)
            .attr("width", 20)
            .attr("height", 10)
            .style("fill", "#CCCCCC")
            .style("opacity", 0.8);
        
        legend.append("text")
            .attr("x", 25)
            .attr("y", 90)
            .text("Recession")
            .style("font-size", "12px");


        document.getElementById('indicator-select').addEventListener('change', function() {
            const selectedIndicator = this.value;
            

            svg.selectAll('rect').style('opacity', 0.1);
            svg.select('.unemployment-line').style('opacity', 0.1);
            svg.select('.inflation-line').style('opacity', 0.1);
            

            switch(selectedIndicator) {
                case 'interest':
                    svg.selectAll('rect').style('opacity', 1);
                    break;
                case 'unemployment':
                    svg.select('.unemployment-line').style('opacity', 1);
                    break;
                case 'inflation':
                    svg.select('.inflation-line').style('opacity', 1);
                    break;
                default:
                    svg.select('.line').style('opacity', 1);
                    svg.select('.inflation-line').style('opacity', 1);
            }
        });


        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", margin.left - 80)  
            .attr("x", -(height / 2))
            .attr("dy", "1em")
            .attr("text-anchor", "middle")
            .text("Closing Price $ (USD)");
    });
}

function calculateCorrelation(x, y) {
    const n = x.length;
    if (n === 0 || n !== y.length) return 0;
    
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;
    
    for (let i = 0; i < n; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i];
        sumY2 += y[i] * y[i];
    }
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
}

function alignData(data1, data2) {
    const dateMap = new Map();
    
    const dateFormat = d3.timeFormat('%Y-%m-%d');
    
    data1.forEach(d => {
        if (d.Date && d.Close) {
            const dateKey = dateFormat(d.Date);
            dateMap.set(dateKey, {
                date: d.Date,
                'S&P 500': d.Close
            });
        }
    });
    
    data2.forEach(d => {
        if (d.Date) {
            const dateKey = dateFormat(d.Date);
            if (dateMap.has(dateKey)) {
                const entry = dateMap.get(dateKey);
                
                if (d['Effective Federal Funds Rate'] !== undefined && 
                    !isNaN(d['Effective Federal Funds Rate'])) {
                    entry['Interest Rate'] = d['Effective Federal Funds Rate'];
                }
                
                if (d['Unemployment Rate'] !== undefined && 
                    !isNaN(d['Unemployment Rate'])) {
                    entry['Unemployment'] = d['Unemployment Rate'];
                }
                
                if (d['Inflation Rate'] !== undefined && 
                    !isNaN(d['Inflation Rate'])) {
                    entry['Inflation'] = d['Inflation Rate'];
                }
            }
        }
    });
    
    const result = Array.from(dateMap.values()).filter(d => {
        if (d['S&P 500'] === undefined || isNaN(d['S&P 500'])) return false;
        
        return (d['Interest Rate'] !== undefined && !isNaN(d['Interest Rate'])) || 
               (d['Unemployment'] !== undefined && !isNaN(d['Unemployment'])) || 
               (d['Inflation'] !== undefined && !isNaN(d['Inflation']));
    });
    
    console.log("Aligned data points:", result.length);
    console.log("S&P 500 data points:", result.filter(d => d['S&P 500'] !== undefined && !isNaN(d['S&P 500'])).length);
    console.log("Interest Rate data points:", result.filter(d => d['Interest Rate'] !== undefined && !isNaN(d['Interest Rate'])).length);
    console.log("Unemployment data points:", result.filter(d => d['Unemployment'] !== undefined && !isNaN(d['Unemployment'])).length);
    console.log("Inflation data points:", result.filter(d => d['Inflation'] !== undefined && !isNaN(d['Inflation'])).length);
    
    return result;
}

function createCorrelationHeatmap(data1, data2) {
    // Align the data first
    const alignedData = alignData(data1, data2);
    
    // Minimum number of data points required for a valid correlation
    const MIN_DATA_POINTS = 10;
    
    // Define the variables to include in the correlation matrix
    const variables = ['S&P 500', 'Interest Rate', 'Unemployment', 'Inflation'];
    
    // Calculate correlation matrix
    const correlationMatrix = [];
    variables.forEach((var1, i) => {
        correlationMatrix[i] = [];
        variables.forEach((var2, j) => {
            // Same variable always has correlation 1.0
            if (var1 === var2) {
                correlationMatrix[i][j] = 1.0;
                return;
            }
            
            // Filter to only include entries that have both variables
            const validData = alignedData.filter(d => 
                d[var1] !== undefined && d[var2] !== undefined && 
                !isNaN(d[var1]) && !isNaN(d[var2]));
            
            if (validData.length >= MIN_DATA_POINTS) {
                const var1Values = validData.map(d => +d[var1]); // Convert to number with +
                const var2Values = validData.map(d => +d[var2]);
                correlationMatrix[i][j] = calculateCorrelation(var1Values, var2Values);
                
                // Check for NaN results from the calculation
                if (isNaN(correlationMatrix[i][j])) {
                    correlationMatrix[i][j] = 0;
                    console.warn(`Correlation between ${var1} and ${var2} resulted in NaN`);
                }
            } else {
                correlationMatrix[i][j] = 0;
                console.warn(`Not enough data points for correlation between ${var1} and ${var2}, only ${validData.length} points`);
            }
        });
    });
    
    // Create the heatmap
    const width = 500;
    const height = 500;
    const margin = { top: 80, right: 50, bottom: 50, left: 80 };
    
    const cellSize = Math.min(
        (width - margin.left - margin.right) / variables.length,
        (height - margin.top - margin.bottom) / variables.length
    );
    
    // Clear previous SVG if it exists
    d3.select('#correlation-heatmap svg').remove();
    
    const svg = d3.create('svg')
        .attr('width', width)
        .attr('height', height);
    
    document.getElementById('correlation-heatmap').appendChild(svg.node());
    
    // Create a tooltip
    d3.select('.cell-tooltip').remove(); // Remove any existing tooltip
    const tooltip = d3.select('#correlation-heatmap')
        .append('div')
        .attr('class', 'cell-tooltip')
        .style('opacity', 0);
    
    // Create a color scale for the correlation values
    const colorScale = d3.scaleLinear()
        .domain([-1, 0, 1])
        .range(['#c51b7d', '#f7f7f7', '#4d9221']);
    
    // Create x and y scales
    const x = d3.scaleBand()
        .domain(variables)
        .range([margin.left, margin.left + cellSize * variables.length]);
    
    const y = d3.scaleBand()
        .domain(variables)
        .range([margin.top, margin.top + cellSize * variables.length]);
    
    // Add the cells
    svg.selectAll('rect')
        .data(correlationMatrix.flat().map((value, i) => {
            const row = Math.floor(i / variables.length);
            const col = i % variables.length;
            return {
                row,
                col,
                value,
                var1: variables[row],
                var2: variables[col]
            };
        }))
        .join('rect')
        .attr('x', d => x(d.var2))
        .attr('y', d => y(d.var1))
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('fill', d => isNaN(d.value) ? '#ccc' : colorScale(d.value))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .on('mouseover', function(event, d) {
            if (!isNaN(d.value)) { // Only show tooltip for valid values
                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                tooltip.html(`${d.var1} vs ${d.var2}<br>Correlation: ${d.value.toFixed(2)}`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            }
        })
        .on('mouseout', function() {
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
        });
    
    // Add the axis labels
    svg.append('g')
        .attr('transform', `translate(0,${margin.top})`)
        .selectAll('text')
        .data(variables)
        .join('text')
        .attr('x', d => x(d) + cellSize / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .text(d => d);
    
    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .selectAll('text')
        .data(variables)
        .join('text')
        .attr('x', -10)
        .attr('y', d => y(d) + cellSize / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .text(d => d);
    
    // Add correlation values to the cells
    svg.selectAll('.correlation-value')
        .data(correlationMatrix.flat().map((value, i) => {
            const row = Math.floor(i / variables.length);
            const col = i % variables.length;
            return {
                row,
                col,
                value,
                var1: variables[row],
                var2: variables[col]
            };
        }))
        .join('text')
        .attr('class', 'correlation-value')
        .attr('x', d => x(d.var2) + cellSize / 2)
        .attr('y', d => y(d.var1) + cellSize / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('fill', d => isNaN(d.value) ? '#666' : (Math.abs(d.value) > 0.5 ? '#fff' : '#000'))
        .text(d => isNaN(d.value) ? 'N/A' : d.value.toFixed(2));
    
    // Add a title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', margin.top / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', '16px')
        .attr('font-weight', 'bold')
        .text('Correlation Between Economic Indicators');
        
    // Add a subtitle about data
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', margin.top / 2 + 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#666')
        .text(`Based on ${alignedData.length} data points`);
}

function updateChart(data1, data2, svg, x, y1, y2, line, bars, path, 
                   recessions, barWidth, height, margin, unemploymentPath, 
                   inflationPath, unemploymentLine, inflationLine) {
    let startDate = d3.timeParse('%Y-%m-%d')(document.getElementById('start-date').value);
    let endDate = d3.timeParse('%Y-%m-%d')(document.getElementById('end-date').value);

    const minDate = d3.timeParse('%Y-%m-%d')('1954-07-01');
    const maxDate = d3.timeParse('%Y-%m-%d')('2017-03-16');

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
    
    const filteredData1 = data1.filter(d1 => 
        d1.Date && !isNaN(d1.Date) && 
        d1.Date >= startDate && d1.Date <= endDate &&
        d1['Close'] !== undefined && !isNaN(d1['Close'])
    );
    
    const filteredData2 = data2.filter(d2 => 
        d2.Date && !isNaN(d2.Date) && 
        d2.Date >= startDate && d2.Date <= endDate &&
        d2['Effective Federal Funds Rate'] !== undefined && 
        !isNaN(d2['Effective Federal Funds Rate'])
    );

    const filteredUnemploymentData = filteredData2
        .filter(d => d['Unemployment Rate'] !== undefined && 
               !isNaN(d['Unemployment Rate']) && 
               d['Unemployment Rate'] > 0 && 
               d['Unemployment Rate'] < 20)
        .sort((a, b) => a.Date - b.Date);

    const filteredInflationData = filteredData2
        .filter(d => {
            const inflationValue = d['Inflation Rate'];
            return inflationValue !== undefined && 
                  inflationValue !== null && 
                  !isNaN(parseFloat(inflationValue)) &&
                  d.Date && !isNaN(d.Date.getTime());
        })
        .map(d => ({
            Date: d.Date,
            'Inflation Rate': parseFloat(d['Inflation Rate'])
        }))
        .sort((a, b) => a.Date - b.Date);

    // Update domains based on filtered data
    x.domain([startDate, endDate]);
    
    // Update y1 domain (S&P 500) only if there is data
    if (filteredData1.length > 0) {
        y1.domain([d3.min(filteredData1, d1 => d1['Close']) * 0.95, 
                 d3.max(filteredData1, d1 => d1['Close']) * 1.05]).nice();
    }
    
    // Update y2 domain (Interest Rate) only if there is data
    if (filteredData2.length > 0) {
        y2.domain([0, d3.max(filteredData2, d2 => d2['Effective Federal Funds Rate']) * 1.05]).nice();
    }
    
    // Update the line
    path.datum(filteredData1)
        .transition()
        .duration(500)
        .attr('d', line);
    
    // Update the bars
    bars.data(filteredData2)
        .transition()
        .duration(500)
        .attr('x', d2 => x(d2.Date) - barWidth / 2)
        .attr('y', d2 => {
            const yPos = y2(d2['Effective Federal Funds Rate']);
            return isNaN(yPos) ? height - margin.bottom : yPos;
        })
        .attr('height', d2 => {
            const barHeight = height - margin.bottom - y2(d2['Effective Federal Funds Rate']);
            return isNaN(barHeight) || barHeight < 0 ? 0 : barHeight;
        });

    const yearDiff = endDate.getFullYear() - startDate.getFullYear();
    const tickCount = Math.max(5, Math.min(10, yearDiff));
    
    svg.select('.x-axis')
        .transition()
        .duration(500)
        .call(d3.axisBottom(x).ticks(tickCount))
        .selectAll('text')
        .style('font-size', '14px');
    
    // Update y axis with animation
    svg.select('.y-axis')
        .transition()
        .duration(500)
        .call(d3.axisLeft(y1))
        .selectAll('text')
        .style('font-size', '14px');
    
    // Update secondary y axis with animation
    svg.select('.y-axis2')
        .transition()
        .duration(500)
        .call(d3.axisRight(y2))
        .selectAll('text')
        .style('font-size', '14px');
        

    const unemploymentY = d3.scaleLinear()
        .domain([0, d3.max(filteredUnemploymentData, d => d['Unemployment Rate']) * 1.05])
        .nice()
        .range([height - margin.bottom, margin.top]);
        
    unemploymentLine.y(d => unemploymentY(d['Unemployment Rate']));
    
    unemploymentPath
        .datum(filteredUnemploymentData)
        .transition()
        .duration(500)
        .attr('d', unemploymentLine);
    

    const inflationY = d3.scaleLinear()
        .domain([
            d3.min(filteredInflationData, d => d['Inflation Rate']) < 0 ? 
                d3.min(filteredInflationData, d => d['Inflation Rate']) * 1.05 : 0, 
            d3.max(filteredInflationData, d => d['Inflation Rate']) * 1.05
        ])
        .nice()
        .range([height - margin.bottom, margin.top]);
        
    inflationLine.y(d => inflationY(d['Inflation Rate']));
    
    inflationPath
        .datum(filteredInflationData)
        .transition()
        .duration(500)
        .attr('d', inflationLine);
   
    if (recessions) {
        svg.selectAll(".recession-zone").remove();
        

        recessions.forEach(recession => {
            if (recession.start && recession.end && 
                !isNaN(recession.start) && !isNaN(recession.end) &&
                ((recession.start >= startDate && recession.start <= endDate) || 
                 (recession.end >= startDate && recession.end <= endDate) ||
                 (recession.start <= startDate && recession.end >= endDate))) {
                
                const rectStart = Math.max(startDate, recession.start);
                const rectEnd = Math.min(endDate, recession.end);
                const rectX = x(rectStart);
                const rectWidth = x(rectEnd) - x(rectStart);
                const rectHeight = height - margin.top - margin.bottom;
                
                // Only draw if dimensions are valid
                if (!isNaN(rectX) && !isNaN(rectWidth) && rectWidth > 0 && rectHeight > 0) {
                    svg.append("rect")
                        .attr("class", "recession-zone")
                        .attr("x", rectX)
                        .attr("y", margin.top)
                        .attr("width", rectWidth)
                        .attr("height", rectHeight)
                        .attr("fill", "#CCCCCC")
                        .attr("opacity", 0.5);
                }
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", function() {
    createLineChart();
});
