const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRNb_HtIJEjBMQqtoSYdAsx6X-kE-bHZ_1SzIHTKq_mfPCoxyZWXuAw21P6K_JwdqihIVHJAJgtmbSI/pub?gid=1659733036&single=true&output=csv'; // Replace with your CSV link

function drawPieChart(containerId, data, title) {
  const width = 300, height = 300, radius = Math.min(width, height) / 2;
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  const svg = d3.select(containerId)
    .append("svg")
    .attr("width", width)
    .attr("height", height + 40)
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

  const pie = d3.pie().value(d => d.value);
  const arc = d3.arc().innerRadius(60).outerRadius(radius);

  svg.selectAll("path")
    .data(pie(data))
    .join("path")
    .attr("d", arc)
    .attr("fill", (d, i) => color(i))
    .append("title")
    .text(d => `${d.data.label}: ${d.data.value}%`);

  d3.select(containerId)
    .append("div")
    .style("text-align", "center")
    .style("margin-top", "-20px")
    .style("font-weight", "bold")
    .text(title);
}

fetch(sheetUrl)
  .then(res => res.text())
  .then(csv => {
    const rows = d3.csvParse(csv);
    const paguData = rows.map(r => ({ label: r.Label, value: +r.Pagu }));
    const realisasiData = rows.map(r => ({ label: r.Label, value: +r.Realisasi }));

    drawPieChart("#paguChart", paguData, "Pagu");
    drawPieChart("#realisasiChart", realisasiData, "Realisasi");
  });