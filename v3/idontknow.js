//import atompos from "./readciffile.js";   // when this line is used to import, real time calculation (onmouseup) function does not work
//console.log(atompos)
//console.log (atompos)
console.log('Hello World');
// (xyz),(-xy-z),(xy+1/2z+1/2),(-x-y-z+1/2)??? not sure
// lets say the answer was already clear:

atomstype1x = []; atomstype2x = [];
        atomstype1y = []; atomstype2y = [];
        atomstype1z = []; atomstype2z = [];


let indice

      document.getElementById('mySubmit').onclick = function(){
        
        indice=document.getElementById('myText').value;
        console.log(indice)
        spacegroup='Cmcm'


// attempted importing and calculation of atomic positions
//let module =require('./readciffile.js')
//let atompos = module.atompos;
//Array.map(item => console.log(item + 1))
let tentcount=0;

console.log(atomicposition)   /// export successful
console.log(atompos)          /// export successful
console.log(celllengtha)      /// export successful
//console.log(atompos)           /// cannot be exported from readciffile
//console.log(startingvaluematrix)  /// 2d array cannot be exported from readciffile for some reason

        
        let q=0;
        direction=[];
        for (let hi=-5; hi<=5; hi++)
            {for (let ki=-5; ki<=5; ki++)
                    
                {for (let li=-25; li<=25; li++){
                    direction[q]=[`${hi}, ${ki}, ${li}`]
                    q=q+1;
                    }
                    }
                }
        console.log(direction)
        // creating all planes
        const listofplanes = [];
        for (let h = -5; h <= 5; h++) 
            {for (let k = -5; k <= 5; k++) 
                {for (let l = -25; l <= 25; l++) 
                   {listofplanes.push([h, k, l]);} 
                }
            }
        
        console.log(listofplanes)
        
        // Find reciprocal lattice vectors:
        let a = [celllengtha, 0, 0];
        let b= [0, celllengthb, 0];
        let c = [0, 0, celllengthc];
        atomcell=[a,b,c];
        console.log(atomcell)
        
        function crossProduct(v1, v2) {
            return [
                v1[1] * v2[2] - v1[2] * v2[1],
                v1[2] * v2[0] - v1[0] * v2[2],
                v1[0] * v2[1] - v1[1] * v2[0]
            ];
        }
        
        function dotProduct(v1, v2) {
            return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
        }
        
        let bCrossC=crossProduct(b,c);
        let aStar=crossProduct(b,c).map(x =>x/dotProduct(a,bCrossC));
        let bStar=crossProduct(c,a).map(x =>x /dotProduct(a,bCrossC));
        let cStar=crossProduct(a,b).map(x =>x /dotProduct(a,bCrossC));
        
        let reciprocalgvectors = [aStar, bStar, cStar];
        console.log(reciprocalgvectors)
        
        
        // calculate structure factor for all planes:
        let STRUCF={};
        let strucfunc=[];
        let d=0;
        for (let hi=-5; hi<=5; hi++)
            {for (let ki=-5; ki<=5; ki++)
                
                {for (let li=-25; li<=25; li++){
                    let a=0;
                    let BIGF = { re: 0, im: 0 }; 
                    for (let i = 0; i < atompos.length; i++) {
                        const positionofatoms = atompos[i];
                        const angle = 2 * Math.PI * (hi * positionofatoms[0] + ki * positionofatoms[1] + li * positionofatoms[2]);
                        BIGF.re += Math.cos(angle);
                        BIGF.im += Math.sin(angle);
                        a++;
                        if (a === 16) {
                            STRUCF[`${hi},${ki},${li}`] = Math.sqrt(BIGF.re ** 2 + BIGF.im ** 2);
                            strucfunc[d]=Math.sqrt(BIGF.re ** 2 + BIGF.im ** 2);
                            d=d+1;
                    }
                    }
                }
            }
            }
            
            console.log(STRUCF)
            console.log(STRUCF['1,-3,1'])
            console.log(strucfunc)
            //console.log(atompos[0][0])
        
        
        
        function digits(n) {
            return Array.from(String(n), Number);
          }
          
        
        let inputplane = digits(indice)
        console.log(inputplane)
        
        let desiredplane=[[inputplane[0]],[inputplane[1]],[inputplane[2]]];
        console.log(desiredplane)
        //sets plane of interest as the x3 direction and normalizes
        
        //math = require("mathjs")
        function normalize(inputvector) {
            const magnitude = Math.sqrt(((inputvector[0])**2)+((inputvector[1])**2)+((inputvector[2])**2));
            returnvector=[inputvector[0]/magnitude, inputvector[1]/magnitude, inputvector[2]/magnitude]
            return returnvector;
        }
        let trial=normalize([1,2,3]);
        //console.log(Math.hypot(1,2,3))
        console.log(trial)
        
        const multiplyMatrices = (a, b) => {
            if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) {
               throw new Error('arguments should be in 2-dimensional array format');
            }
            let x = a.length,
            z = a[0].length,
            y = b[0].length;
            if (b.length !== z) {
               // XxZ & ZxY => XxY
               throw new Error('number of columns in the first matrix should be the same as the number of rows in the second');
            }
            let productRow = Array.apply(null, new Array(y)).map(Number.prototype.valueOf, 0);
            let product = new Array(x);
            for (let p = 0; p < x; p++) {
               product[p] = productRow.slice();
            }
            for (let i = 0; i < x; i++) {
               for (let j = 0; j < y; j++) {
                  for (let k = 0; k < z; k++) {
                     product[i][j] += a[i][k] * b[k][j];
                  }
               }
            }
            return product;
         }
        
        noromalplanetrial=multiplyMatrices(atomcell,desiredplane)
        noromalplanetrial=normalize(noromalplanetrial)
        console.log(noromalplanetrial)
        
        function cross(a, b) {
            return [
                a[1] * b[2] - a[2] * b[1],
                a[2] * b[0] - a[0] * b[2],
                a[0] * b[1] - a[1] * b[0]
            ];
        }
        
        
        // Creates vectors for new basis
        const dummyvector = Math.abs(noromalplanetrial[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
        //console.log(dummyvector)
        let yvector = cross(dummyvector, noromalplanetrial);
        yvector=normalize(yvector);
        //console.log(yvector)
        let xvector = cross(noromalplanetrial, yvector);
        xvector=normalize(xvector);
        
        let convertingbasis = [xvector, yvector, noromalplanetrial];
        console.log(convertingbasis)
        
        // Atomic position points in reciprocal space
        let gatomicpositions = multiplyMatrices(listofplanes,reciprocalgvectors);
        
        // Projected coordinates of reciprocal atomic position vectors in converting basis to the crystallographic basis
        let proj_coords = multiplyMatrices(gatomicpositions,convertingbasis)
        
        console.log(proj_coords)
        console.log(proj_coords[[0][0]])
        
        
        // Helper function for dot product
        function dotProduct(a, b) {
            return a.reduce((sum, val, index) => sum + val * b[index], 0);
        }

          //trial
        w=0;
        let trialdataPoints = [];
        let trialtrialdatapoints=[];
        for (let i = 0; i < proj_coords.length; i++) {
            let datavector = proj_coords[i]
            trialdataPoints[i]={x: datavector[0], y: datavector[1],label: direction[i],markerSize:((strucfunc[i]/5)**2)}
            if (strucfunc[i]>0.001){
                trialtrialdatapoints[w]=trialdataPoints[i];
                w=w+1;
            }
        
          }
        
        for (let i = 0; i < atompos.length; i++){
            if (atompos[i][3] === element1){
                atomstype1x.push(atompos[i][0]);
                atomstype1y.push(atompos[i][1]);
                atomstype1z.push(atompos[i][2]);
            }
            if (atompos[i][3] === element2){
                atomstype2x.push(atompos[i][0]);
                atomstype2y.push(atompos[i][1]);
                atomstype2z.push(atompos[i][2]);
            }
        }
        console.log(atomstype1x)
        
        var atomstype2={x: atomstype2x,
            y: atomstype2y,
            z:atomstype2z, mode: 'markers',
        
            marker: {
                size: 12,
                line: {
                color: 'rgba(217, 217, 217, 0.14)',
                width: 0.5},
                opacity: 0.8},
                type:'scatter3d',name: element2};
        //console.log(structuredat)
        var atomstype1={x:atomstype1x,
            y:atomstype1y,
            z:atomstype1z, mode: 'markers',
            marker: {
                size: 12,
                line: {
                color: 'rgba(65, 192, 234, 0.14)',
                width: 0.5},
                opacity: 0.8},
                type:'scatter3d',name:element1};
        //console.log(structuredat)
        var layout = {
            title: {
            text: 'Cmcm '+ '<'+indice+'>'
            }, legend:{font:{size:20}},
            scene:{camera : {
                eye:{x: inputplane[1],
                    y: inputplane[2],
                    z: inputplane[0]}
            }}
        };
        
        console.log(trialdataPoints)
        data=[atomstype1,atomstype2]
        Plotly.newPlot('structureCanvas', data, layout,width=100,height=100);
              
            //chart = chart.getContext("2d", { willReadFrequently: true });
            // CanvasJS chart for diffractionCanvas
            var chart = new CanvasJS.Chart("diffractionCanvas", {
                axisX: {gridThickness: 0, lineThickness: 1, tickThickness: 0, minimum:-1.0, maximum:1.0, labelFormatter: function () {return "";}},
                axisY: {gridThickness: 0, lineThickness: 1, tickThickness: 0, minimum:-2, maximum:2, labelFormatter: function () {return "";}},
                title:{text:'<'+indice+'>' ,fontFamily: 'tahoma',fontSize: 30},
                data: [{
                  type: "scatter",
                  markerColor: "black",
                  toolTipContent: "{label}",
                  dataPoints: trialtrialdatapoints,
                }]
              });
            chart.render();
        chart.render();
        
        document.getElementById('structureCanvas').onmouseup = function(){ 
        console.log(atompos)
          //var gd = scene.graphDiv;
          console.log(layout.scene.camera.eye)
          newindice=layout.scene.camera.eye;
          console.log(newindice.x)
          spacegroup='Cmcm'
    
        
        //Suppose want to look at (521)
        
        function digits(n) {
            return Array.from(String(n), Number);
          }

        
        inputplane[0] = newindice.z; inputplane[1] = newindice.x; inputplane[2] = newindice.y

        console.log(inputplane)
        inputplane[0]=Math.round(inputplane[0]); inputplane[1]=Math.round(inputplane[1]); inputplane[2]=Math.round(inputplane[2]);
        
        let desiredplane=[[inputplane[0]],[inputplane[1]],[inputplane[2]]];
        console.log(desiredplane)
        //sets plane of interest as the x3 direction and normalizes
        
        
        noromalplanetrial=multiplyMatrices(atomcell,desiredplane)
        noromalplanetrial=normalize(noromalplanetrial)
        console.log(noromalplanetrial)
        
        
        // Creates vectors for new basis
        const dummyvector = Math.abs(noromalplanetrial[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
        //console.log(dummyvector)
        let yvector = cross(dummyvector, noromalplanetrial);
        yvector=normalize(yvector);
        //console.log(yvector)
        let xvector = cross(noromalplanetrial, yvector);
        xvector=normalize(xvector);
        
        let convertingbasis = [xvector, yvector, noromalplanetrial];
        console.log(convertingbasis)
        
        // Atomic position points in reciprocal space
        let gatomicpositions = multiplyMatrices(listofplanes,reciprocalgvectors);
        
        // Projected coordinates of reciprocal atomic position vectors in converting basis to the crystallographic basis
        let proj_coords = multiplyMatrices(gatomicpositions,convertingbasis)
        
        console.log(proj_coords)
        console.log(proj_coords[[0][0]])
        
        
        // Helper function for dot product
        function dotProduct(a, b) {
            return a.reduce((sum, val, index) => sum + val * b[index], 0);
        }
        var dataPoints = [
            { x: 1, y: 1, label: "110" , markerSize:10}, // Replace datapoints with the projected structure factor, and label with the hkl indices
            { x: -1, y: 1, label: "-110", markerSize:20},
            { x: 1, y: -1, label: "1-10", markerSize:15 },
            { x: -1, y: -1, label: "-1-10", markerSize:8 },
            { x: 2, y: 1, label: "210", markerSize:12 }
          ];
        console.log(dataPoints)
          //trial
        w=0;
        let trialdataPoints = [];
        let trialtrialdatapoints=[];
        for (let i = 0; i < proj_coords.length; i++) {
            let datavector = proj_coords[i]
            trialdataPoints[i]={x: datavector[0], y: datavector[1],label: direction[i],markerSize:((strucfunc[i]/5)**2)}
            if (strucfunc[i]>0.001){
                trialtrialdatapoints[w]=trialdataPoints[i];
                w=w+1;
            }
        
          }
        
        var chart = new CanvasJS.Chart("diffractionCanvas", {
                axisX: {gridThickness: 0, lineThickness: 1, tickThickness: 0, minimum:-1.0, maximum:1.0, labelFormatter: function () {return "";}},
                axisY: {gridThickness: 0, lineThickness: 1, tickThickness: 0, minimum:-2, maximum:2, labelFormatter: function () {return "";}},
                title:{text:'<'+inputplane+'>' ,fontFamily: 'tahoma',fontSize: 30},
                data: [{
                  type: "scatter",
                  markerColor: "black",
                  toolTipContent: "{label}",
                  dataPoints: trialtrialdatapoints,
                }]
              });
            chart.render();
             console.log(cellgammaangle); 
        }
        console.log('complete')
         
    }
    