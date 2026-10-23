 // Uncomment the following block for a static scatter plot, also would need to change the <div> element into <canvas> element in HTML.
/*
const canvas = document.getElementById("chartID1");
const ctx = canvas.getContext("2d");

const data = [
    { x: 10, y: 20 },
    { x: 50, y: 80 },
    { x: 100, y: 50 },
    { x: 150, y: 120 },
    { x: 200, y: 30 }
];


function drawScatterPlot() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const point of data) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        ctx.fill();
    }
}

drawScatterPlot();

*/

var dataPoints = [
    { x: 1, y: 1, label: "110" , markerSize:10}, // Replace datapoints with the projected structure factor, and label with the hkl indices
    { x: -1, y: 1, label: "-110", markerSize:20},
    { x: 1, y: -1, label: "1-10", markerSize:15 },
    { x: -1, y: -1, label: "-1-10", markerSize:8 },
    { x: 2, y: 1, label: "210", markerSize:12 }
  ];

window.onload = function () {
    
    // Regular canvas for structureCanvas
    var structureCanvas = document.getElementById('structureCanvas');
    var ctx = structureCanvas.getContext('2d');

    // Placeholder for ball and stick model
    ctx.fillStyle = 'blue';
    ctx.fillRect(0, 0, 250, 250);
  
    // CanvasJS chart for diffractionCanvas
    var chart = new CanvasJS.Chart("diffractionCanvas", {
      axisX: {gridThickness: 0, lineThickness: 0, tickThickness: 0, minimum:-3, maximum:3, labelFormatter: function () {return "";}},
      axisY: {gridThickness: 0, lineThickness: 0, tickThickness: 0, minimum:-3, maximum:3, labelFormatter: function () {return "";}},
      data: [{
        type: "scatter",
        markerColor: "black",
        toolTipContent: "{label}",
        dataPoints: dataPoints,
      }]
    });
    chart.render();
  };
  

  