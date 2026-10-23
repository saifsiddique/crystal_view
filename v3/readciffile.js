function isLetter(character) {
  return /^[A-Za-z]$/.test(character);
}

function isNumber(value) {
 return !isNaN(value);
}

let atomicposition=[[]];


let atomicposition1 = '';
let atomicposition2 = '';
let atomicposition3 = '';
let atomicposition4 = '';
let atomicposition5 = '';
let atomicposition6 = '';
let atomicposition7 = '';
let atomicposition8 = '';
let atomicposition9 = '';
let atomicposition10 = '';
let atomicposition11 = '';
let atomicposition12 = '';
let atomicposition13 = '';
let atomicposition14 = '';
let atomicposition15 = '';
let atomicposition16 = '';
let atomicposition17 = '';
let atomicposition18 = '';
let atomicposition19 = '';
let atomicposition20 = '';
let atomicposition21 = '';
let atomicposition22 = '';
let atomicposition23 = '';
let atomicposition24 = '';


// Attempt #1 at reading CIF File
const fileInput = document.getElementById("cifFile");
const fileContentDisplay = document.getElementById("file-content");
const messageDisplay = document.getElementById("message");

fileInput.addEventListener("change", handleFileSelection);

function handleFileSelection(event) {
  const file = event.target.files[0];
  fileContentDisplay.textContent = ""; // Clear previous file content
  messageDisplay.textContent = ""; // Clear previous messages
  
  // Validate file existence and type
  if (!file) {
    showMessage("No file selected. Please choose a file.", "error");
    return;
  }

element1found=0;
element2found=0;
let spacecounter=0;
let spacebarcounter=0;

  // Read the file
  const reader = new FileReader();
  reader.onload = () => {
    fileContentDisplay.textContent = reader.result;
    let cifinfo=reader.result
    //console.log(cifinfo)
    cifinfo=cifinfo.toString();
    console.log(cifinfo)
// Chemical Components
    for (let i = 0; i < cifinfo.length; i++) {
      if ( cifinfo[i-22]==='_' && cifinfo[i-21]==='c' && cifinfo[i-12]==='f' && cifinfo[i-3]==='u' && cifinfo[i]=="'") {
        console.log('works111')
        w=i+1;
        while (cifinfo[w] !== "'"){
          if (cifinfo[w]==' '){
          w=w+1;
          spacecounter=spacecounter+1;
          }
          else{
          w=w+1;
          }
        }
        let d=i+1;
        if(spacecounter == 0){
          if(isLetter(cifinfo[d]) === true && isLetter(cifinfo[d+1]) === true && isNumber(cifinfo[d+2]) === true && isNumber(cifinfo[d+3] === true)){
            element1=cifinfo[d]+cifinfo[d+1];
            element1number=cifinfo[d+2]+cifinfo[d+3];
          }
          if(isLetter(cifinfo[d]) === true && isLetter(cifinfo[d+1]) === true && isNumber(cifinfo[d+2]) === true && isNumber(cifinfo[d+3] === false)){
            element1=cifinfo[d]+cifinfo[d+1];
            element1number=cifinfo[d+2];
          }
          if(isLetter(cifinfo[d]) === true && isLetter(cifinfo[d+1]) === false && isNumber(cifinfo[d+1]) === true && isNumber(cifinfo[d+2] === true)){
            element1=cifinfo[d];
            element1number=cifinfo[d+1]+cifinfo[d+2];
          }
          if(isLetter(cifinfo[d]) === true && isLetter(cifinfo[d+1]) === false && isNumber(cifinfo[d+1]) === true && isNumber(cifinfo[d+2] === false)){
            element1=cifinfo[d];
            element1number=cifinfo[d+1];
          }
        }
        if(spacecounter == 1){
          if(isLetter(cifinfo[d]) === true && isLetter(cifinfo[d+1]) === true && isNumber(cifinfo[d+2]) === true && isNumber(cifinfo[d+3] === true)){
            element1=cifinfo[d]+cifinfo[d+1];
            element1number=cifinfo[d+2]+cifinfo[d+3];
            element1found=3;
          }
          if(isLetter(cifinfo[d]) === true && isLetter(cifinfo[d+1]) === true && isNumber(cifinfo[d+2]) === true && isNumber(cifinfo[d+3] === false)){
            element1=cifinfo[d]+cifinfo[d+1];
            element1number=cifinfo[d+2];
            element1found=2;
          }
          if(isLetter(cifinfo[d]) === true && isLetter(cifinfo[d+1]) === false && isNumber(cifinfo[d+1]) === true && isNumber(cifinfo[d+2] === true)){
            element1=cifinfo[d];
            element1number=cifinfo[d+1]+cifinfo[d+2];
            element1found=2;
          }
          if(isLetter(cifinfo[d]) === true && isLetter(cifinfo[d+1]) === false && isNumber(cifinfo[d+1]) === true && isNumber(cifinfo[d+2] === false)){
            element1=cifinfo[d];
            element1number=cifinfo[d+1];
            element1found=1;
          }
        }
        if(spacecounter==1 && element1found !==0){
          if(isLetter(cifinfo[d+2+element1found]) === true && isLetter(cifinfo[d+3+element1found]) === true && isNumber(cifinfo[d+4+element1found]) === true && isNumber(cifinfo[d+5+element1found] === true)){
            element2=cifinfo[d+2+element1found]+cifinfo[d+3+element1found];
            element2number=cifinfo[d+4+element1found]+cifinfo[d+5+element1found];
          }
          if(isLetter(cifinfo[d+2+element1found]) === true && isLetter(cifinfo[d+3+element1found]) === true && isNumber(cifinfo[d+4+element1found]) === true && isNumber(cifinfo[d+5+element1found] === false)){
            element2=cifinfo[d+2+element1found]+cifinfo[d+3+element1found];
            element2number=cifinfo[d+4+element1found];
          }
          if(isLetter(cifinfo[d+2+element1found]) === true && isLetter(cifinfo[d+3+element1found]) === false && isNumber(cifinfo[d+3+element1found]) === true && isNumber(cifinfo[d+4+element1found] === true)){
            element2=cifinfo[d+2+element1found];
            element2number=cifinfo[d+3+element1found]+cifinfo[d+4+element1found];
          }
          if(isLetter(cifinfo[d+2+element1found]) === true && isLetter(cifinfo[d+3+element1found]) === false && isNumber(cifinfo[d+3+element1found]) === true && isNumber(cifinfo[d+4+element1found] === false)){
            element2=cifinfo[d+2+element1found];
            element2number=cifinfo[d+3+element1found];
          }
        }
        if(spacecounter == 2){
          if(isLetter(cifinfo[d]) === true && isLetter(cifinfo[d+1]) === true && isNumber(cifinfo[d+2]) === true && isNumber(cifinfo[d+3] === true)){
            element1=cifinfo[d]+cifinfo[d+1];
            element1number=cifinfo[d+2]+cifinfo[d+3];
            element1found=3;
          }
          if(isLetter(cifinfo[d]) === true && isLetter(cifinfo[d+1]) === true && isNumber(cifinfo[d+2]) === true && isNumber(cifinfo[d+3] === false)){
            element1=cifinfo[d]+cifinfo[d+1];
            element1number=cifinfo[d+2];
            element1found=2;
          }
          if(isLetter(cifinfo[d]) === true && isLetter(cifinfo[d+1]) === false && isNumber(cifinfo[d+1]) === true && isNumber(cifinfo[d+2] === true)){
            element1=cifinfo[d];
            element1number=cifinfo[d+1]+cifinfo[d+2];
            element1found=2;
          }
          if(isLetter(cifinfo[d]) === true && isLetter(cifinfo[d+1]) === false && isNumber(cifinfo[d+1]) === true && isNumber(cifinfo[d+2] === false)){
            element1=cifinfo[d];
            element1number=cifinfo[d+1];
            element1found=1;
          }
        }
        
        if(spacecounter==2 && element1found !==0){
          if(isLetter(cifinfo[d+2+element1found]) === true && isLetter(cifinfo[d+3+element1found]) === true && isNumber(cifinfo[d+4+element1found]) === true && isNumber(cifinfo[d+5+element1found] === true)){
            element2=cifinfo[d+2+element1found]+cifinfo[d+3+element1found];
            element2number=cifinfo[d+4+element1found]+cifinfo[d+5+element1found];
            element2found=5+element1found;
          }
          if(isLetter(cifinfo[d+2+element1found]) === true && isLetter(cifinfo[d+3+element1found]) === true && isNumber(cifinfo[d+4+element1found]) === true && isNumber(cifinfo[d+5+element1found] === false)){
            element2=cifinfo[d+2+element1found]+cifinfo[d+3+element1found];
            element2number=cifinfo[d+4+element1found];
            element2found=4+element1found;
          }
          if(isLetter(cifinfo[d+2+element1found]) === true && isLetter(cifinfo[d+3+element1found]) === false && isNumber(cifinfo[d+3+element1found]) === true && isNumber(cifinfo[d+4+element1found] === true)){
            element2=cifinfo[d+2+element1found];
            element2number=cifinfo[d+3+element1found]+cifinfo[d+4+element1found];
            element2found=4+element1found;
          }
          if(isLetter(cifinfo[d+2+element1found]) === true && isLetter(cifinfo[d+3+element1found]) === false && isNumber(cifinfo[d+3+element1found]) === true && isNumber(cifinfo[d+4+element1found] === false)){
            element2=cifinfo[d+2+element1found];
            element2number=cifinfo[d+3+element1found];
            element2found=3+element1found;
          }
        }

        if(spacecounter==2 && element2found !==0){
          if(isLetter(cifinfo[d+2+element2found]) === true && isLetter(cifinfo[d+3+element2found]) === true && isNumber(cifinfo[d+4+element2found]) === true && isNumber(cifinfo[d+5+element2found] === true)){
            element3=cifinfo[d+2+element2found]+cifinfo[d+3+element2found];
            element3number=cifinfo[d+4+element2found]+cifinfo[d+5+element2found];
            element3found=5+element2found;
          }
          if(isLetter(cifinfo[d+2+element2found]) === true && isLetter(cifinfo[d+3+element2found]) === true && isNumber(cifinfo[d+4+element2found]) === true && isNumber(cifinfo[d+5+element2found] === false)){
            element3=cifinfo[d+2+element2found]+cifinfo[d+3+element2found];
            element3number=cifinfo[d+4+element2found];
            element3found=4+element2found;
          }
          if(isLetter(cifinfo[d+2+element2found]) === true && isLetter(cifinfo[d+3+element2found]) === false && isNumber(cifinfo[d+3+element2found]) === true && isNumber(cifinfo[d+4+element2found] === true)){
            element3=cifinfo[d+2+element2found];
            element3number=cifinfo[d+3+element2found]+cifinfo[d+4+element2found];
            element3found=4+element2found;
          }
          if(isLetter(cifinfo[d+2+element2found]) === true && isLetter(cifinfo[d+3+element2found]) === false && isNumber(cifinfo[d+3+element2found]) === true && isNumber(cifinfo[d+4+element2found] === false)){
            element3=cifinfo[d+2+element2found];
            element3number=cifinfo[d+3+element2found];
            element3found=3+element2found;
          }
        }
        console.log(element1)
        console.log(element2)

        // Atoms:
        if (element1 !== undefined) {
          for (let i = 0; i < cifinfo.length; i++) {
          let p=0;
          let s=0;
          let counter1=0;
          let secondcounter1=0;
          let atomsiteloop='';
          
          if (cifinfo[i]+cifinfo[i+1] === element1 && cifinfo[i+4] === element1[0]) {
                  p=i;
                  console.log(element1[0])
              while (cifinfo[p] !== '#'){
                if (cifinfo[p]=== " "){
                  counter1=counter1+1;
                  console.log(counter1)
                  if (counter1===4){
                    s=p+1;;
                    while (secondcounter1 !==3){
                      atomsiteloop=atomsiteloop+cifinfo[s]; s++;
                      if (cifinfo[s]=== " "){
                        secondcounter1=secondcounter1+1;
                      }
                    }
                      
                  }
                }
                p++;
            }
            console.log(atomsiteloop)    
          }
        }
        }
        
      }
// Cell parameters
      if ( cifinfo[i]==='_' && cifinfo[i+2]==='e' && cifinfo[i+6]==='l' && cifinfo[i+13]==='a') {
          celllengtha=cifinfo[i+15]+cifinfo[i+16]+cifinfo[i+17]+cifinfo[i+18]+cifinfo[i+19];
          celllengtha=Number(celllengtha);
          console.log(celllengtha)
      }
      if ( cifinfo[i]==='_' && cifinfo[i+2]==='e' && cifinfo[i+6]==='l' && cifinfo[i+13]==='b') {
        celllengthb=cifinfo[i+15]+cifinfo[i+16]+cifinfo[i+17]+cifinfo[i+18];
        celllengthb=Number(celllengthb);
        console.log(celllengthb)
      }
      if ( cifinfo[i]==='_' && cifinfo[i+2]==='e' && cifinfo[i+6]==='l' && cifinfo[i+13]==='c') {
        celllengthc=cifinfo[i+15]+cifinfo[i+16]+cifinfo[i+17]+cifinfo[i+18]+cifinfo[i+19];
        celllengthc=Number(celllengthc);
        console.log(celllengthc)
      }
      if ( cifinfo[i]==='_' && cifinfo[i+2]==='e' && cifinfo[i+6]==='a' && cifinfo[i+12]==='a' && cifinfo[i+13]==='l') {
        cellalphaangle=cifinfo[i+18]+cifinfo[i+19]
        cellalphaangle=Number(cellalphaangle);
        console.log(cellalphaangle)
      }
      if ( cifinfo[i]==='_' && cifinfo[i+2]==='e' && cifinfo[i+6]==='a' && cifinfo[i+12]==='b' && cifinfo[i+13]==='e') {
        cellbetaangle=cifinfo[i+17]+cifinfo[i+18]
        cellbetaangle=Number(cellbetaangle);
        console.log(cellbetaangle)
      }
      if ( cifinfo[i]==='_' && cifinfo[i+2]==='e' && cifinfo[i+6]==='a' && cifinfo[i+12]==='g' && cifinfo[i+13]==='a') {
        cellgammaangle = '';
        let f = i + 18;
        while (cifinfo[f] !== '.'){
          cellgammaangle = cellgammaangle + cifinfo[f];
          f++;
        }
        cellgammaangle=Number(cellgammaangle);
        console.log(cellgammaangle)
      }
// Atomic positions
let q
if ( cifinfo[i] === '1' && cifinfo[i+2] === "'"){
  q=i;
  console.log('works1')
  while (cifinfo[q] !== 'l' && cifinfo[q+1] !== 'o' && cifinfo[q+2] !== 'o' && cifinfo[q+3] !== 'p'){
    if (isNumber(cifinfo[q]) === true && cifinfo[q+1] === ' ' && cifinfo[q+2] === "'"){
      let w=q;
      console.log('workst')
      let atomposnumber = '';
      while (cifinfo[w] === '1' || cifinfo[w] === '2' || cifinfo[w] === '3' || cifinfo[w] === '4' || cifinfo[w] === '5' || cifinfo[w] === '6' || cifinfo[w] === '7' || cifinfo[w] === '8' || cifinfo[w] === '9' || cifinfo[w] === '0'){
        atomposnumber = cifinfo[w] + atomposnumber;
        w--;
      }
      atomposnumber = Number(atomposnumber);
      console.log(cifinfo[q])
      console.log(cifinfo[q-1])
      console.log('works2')
      let k = q+3;
      let atomicpositionvalue = ''
      while (cifinfo[k] !== "'"){
        atomicpositionvalue = atomicpositionvalue + cifinfo[k]
        k++;
      }
      atomicposition[atomposnumber-1] = atomicpositionvalue + ","
      console.log('works3')
    }
    q++;
  }
}}

console.log(atomicposition)
  for (let i = 0; i < cifinfo.length; i++) {
  // Starting values
      if (cifinfo[i-1] === 'y' && cifinfo [i-9] === 'o' && cifinfo[i-20] === '_' && element1found !== 0){
        let p=i+1;
        console.log(cifinfo[i])
        while(cifinfo[p]!=='#'){
          if(cifinfo[p]===' '){
            spacebarcounter=spacebarcounter+1;
          }
          p=p+1;
        }
        console.log(spacebarcounter)
      }
    }
var startingvaluematrix = [[]];
for(var i=0; i<(spacebarcounter/8); i++) {
    startingvaluematrix[i] = [];
    for(var j=0; j<4; j++) {
        startingvaluematrix[i][j] = "";
    }
}
spacce=0;
rowcounter=0;
sanity1 = 1;
sanity2 = 1;
sanity3 = 1;
for (let i = 0; i < cifinfo.length; i++) {
   if (cifinfo[i-1] === 'y' && cifinfo [i-9] === 'o' && cifinfo[i-20] === '_' && element1found !== 0){
        let p=i+1;
        console.log(cifinfo[i])
        while(cifinfo[p]!=='#'){
          if(cifinfo[p]===' '){
            spacce=spacce+1;
            console.log(spacce)
            if(spacce % 8 === 0){
            rowcounter=rowcounter+1;
            console.log(rowcounter)
            }
          }
          if(spacce === ((rowcounter)*(8)+(4)) && rowcounter+1 === sanity1){
            console.log('works')
            let r=p+1;
            while(cifinfo[r] !== ' '){
              startingvaluematrix[rowcounter][1] = startingvaluematrix[rowcounter][1] + cifinfo[r];
              r=r+1;
            }
            sanity1 = sanity1 + 1;
          }
          if(spacce === ((rowcounter)*(8)+5) && rowcounter+1 === sanity2){
            let r=p+1;
            while(cifinfo[r] !== ' '){
              startingvaluematrix[rowcounter][2] = startingvaluematrix[rowcounter][2] + cifinfo[r];
              r=r+1;
            }
            sanity2 = sanity2 + 1;
          }
          if(spacce === ((rowcounter)*(8)+6) && rowcounter+1 === sanity3 ){
            let r=p+1;
            while(cifinfo[r] !== ' '){
              startingvaluematrix[rowcounter][3] = startingvaluematrix[rowcounter][3] + cifinfo[r];
              r=r+1;
            }
          sanity3 = sanity3 + 1;

          }
          p=p+1;
          

        }
        }
}
console.log(startingvaluematrix)
console.log(startingvaluematrix.length)

//console.log(startingvaluematrix[1][1])
console.log(cellgammaangle)
console.log(atomicposition.length)

atompos = [];
for(var i=0; i<(atomicposition.length); i++) {
    atompos[i] = [];
    for(var j=0; j<3; j++) {
        atompos[i][j] = [];
    }
}


u=0;
console.log(atompos)

let tentcount=0;
for (let u = 0; u < (atomicposition.length); u++){
  
  if( tentcount === 0){
    let f=0;
    tentcount = 1;
    let commacounter=0;
    while(commacounter < 3){
      if(atomicposition[u][f] ===','){
        commacounter=commacounter+1;
      }
      //XXX
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[0][1]
        atompos[u][0] = Number(ph)
        
        atompos[u][0] = -atompos[u][0]
        if (atompos[u][0] <= 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
        console.log(atompos[u][0])
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[0][1]
        atompos[u][0] = Number(ph)
        if (atompos[u][0] < 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[0][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = -atompos[u][0] + 0.5;
        if (atompos[u][0] < 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
       let ph=startingvaluematrix[0][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = atompos[u][0] + 0.5;
        if (atompos[u][0] < 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }

        //Hexagonal:

      //YYY
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[0][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1]
        if (atompos[u][1] <= 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[0][2]
        atompos[u][1] = Number(ph)
        if (atompos[u][1] < 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
       let ph=startingvaluematrix[0][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1] + 0.5;
        if (atompos[u][1] < 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[0][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = atompos[u][1] + 0.5;
        if (atompos[u][1] < 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }

      //ZZZ
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[0][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2]
        if (atompos[u][2] <= 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[0][3]
        atompos[u][2] = Number(ph)
        if (atompos[u][2] < 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[0][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2] + 0.5;
        if (atompos[u][2] < 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[0][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = atompos[u][2] + 0.5;
        if (atompos[u][2] < 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      f=f+1;
    }
  
}
else if(atomicposition[u] !== '' && tentcount === 1 && (startingvaluematrix.length)-1 >= tentcount){
    let f=0;
    if ((startingvaluematrix.length)-1 === tentcount){
          tentcount = 0;
    }
    else{
      tentcount = 2;
    }
    let commacounter=0;
    while(commacounter < 3){
      if(atomicposition[u][f] ===','){
        commacounter=commacounter+1;
      }
      //XXX
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[1][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = -atompos[u][0]
        if (atompos[u][0] <= 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[1][1]
        atompos[u][0] = Number(ph)
        if (atompos[u][0] < 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[1][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = -atompos[u][0] + 0.5;
        if (atompos[u][0] < 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[1][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = atompos[u][0] + 0.5;
        if (atompos[u][0] < 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }

      //YYY
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[1][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1]
        if (atompos[u][1] <= 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[1][2]
        atompos[u][1] = Number(ph)
        if (atompos[u][1] < 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[1][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1] + 0.5;
        if (atompos[u][1] < 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[1][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = atompos[u][1] + 0.5;
        if (atompos[u][1] < 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }

      //ZZZ
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[1][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2]
        if (atompos[u][2] <= 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[1][3]
        atompos[u][2] = Number(ph)
        if (atompos[u][2] < 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[1][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2] + 0.5;
        if (atompos[u][2] < 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[1][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = atompos[u][2] + 0.5;
        if (atompos[u][2] < 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      f=f+1;
    }
    
  
}

else if(atomicposition[u] !== '' && tentcount === 2 && (startingvaluematrix.length)-1 >= tentcount){
    let f=0;
   if ((startingvaluematrix.length)-1 === tentcount){
          tentcount = 0;
    }
    else{
      tentcount = 3;
    }
    let commacounter=0;
    while(commacounter < 3){
      if(atomicposition[u][f] ===','){
        commacounter=commacounter+1;
      }
      //XXX
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[2][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = -atompos[u][0]
        if (atompos[u][0] <= 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[2][1]
        atompos[u][0] = Number(ph)
        if (atompos[u][0] < 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[2][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = -atompos[u][0] + 0.5;
        if (atompos[u][0] < 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[2][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = atompos[u][0] + 0.5;
        if (atompos[u][0] < 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }

      //YYY
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[2][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1]
        if (atompos[u][1] <= 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[2][2]
        atompos[u][1] = Number(ph)
        if (atompos[u][1] < 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[2][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1] + 0.5;
        if (atompos[u][1] < 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[2][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = atompos[u][1] + 0.5;
        if (atompos[u][1] < 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }

      //ZZZ
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[2][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2]
        if (atompos[u][2] <= 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[2][3]
        atompos[u][2] = Number(ph)
        if (atompos[u][2] < 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[2][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2] + 0.5;
        if (atompos[u][2] < 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[2][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = atompos[u][2] + 0.5;
        if (atompos[u][2] < 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      f=f+1;
    }
    
  
}


else if(atomicposition[u] !== '' && tentcount === 3 && (startingvaluematrix.length)-1 >= tentcount){
    let f=0;
   if ((startingvaluematrix.length)-1 === tentcount){
          tentcount = 0;
    }
    else{
      tentcount = 4;
    }
    let commacounter=0;
    while(commacounter < 3){
      if(atomicposition[u][f] ===','){
        commacounter=commacounter+1;
      }
      //XXX
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1] === ','){
       let ph=startingvaluematrix[3][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = -atompos[u][0]
        if (atompos[u][0] <= 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[3][1]
        atompos[u][0] = Number(ph)
        if (atompos[u][0] < 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[3][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = -atompos[u][0] + 0.5;
        if (atompos[u][0] < 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[3][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = atompos[u][0] + 0.5;
        if (atompos[u][0] < 0){
          atompos[u][0] = atompos[u][0] + 1;
        }
      }

      //YYY
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[3][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1]
        if (atompos[u][1] <= 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[3][2]
        atompos[u][1] = Number(ph)
        if (atompos[u][1] < 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[3][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1] + 0.5;
        if (atompos[u][1] < 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
       let ph=startingvaluematrix[3][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = atompos[u][1] + 0.5;
        if (atompos[u][1] < 0){
          atompos[u][1] = atompos[u][1] + 1;
        }
      }

      //ZZZ
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[3][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2]
        if (atompos[u][2] <= 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[3][3]
        atompos[u][2] = Number(ph)
        if (atompos[u][2] < 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[3][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2] + 0.5;
        if (atompos[u][2] < 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[3][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = atompos[u][2] + 0.5;
        if (atompos[u][2] < 0){
          atompos[u][2] = atompos[u][2] + 1;
        }
        
      }
      f=f+1;
    }
    
  
}

};
let atompostest= atompos;
console.log(atompos)
element1counter = 0;
element2counter = 0;
for (let i = 0; i < cifinfo.length; i++) {
  if (cifinfo[i] === 'y' && cifinfo[i-8] === 'o' && cifinfo[i-13] === 's' && cifinfo[i-18] === 'a'){
    s=i+1;
    while (cifinfo[s] != '#' || cifinfo[s]+cifinfo[s+1]+cifinfo[s+2]+cifinfo[s+3] === 'loop'){
      if (cifinfo[s]+cifinfo[s+1] === element1){
        element1counter = element1counter + 1;
      }
      if (cifinfo[s]+cifinfo[s+1] === element2){
        element2counter=element2counter + 1;
      }
      s++;
    }

  }
}
console.log(element1counter)
console.log(element2counter)
spacec = 0;
let elementchecker = [];

let elementlabel = [];
for (let i=0; i < cifinfo.length; i++){
  if (cifinfo[i] === "'" && cifinfo[i-2] === 'l' && cifinfo[i-11] === 's'&& cifinfo[i-19] === 'f'&& cifinfo[i-28] === 'c'){
    let d=i+1;
    while (cifinfo[d] !== "'"){
      if (cifinfo[d] !== ' '){
      elementchecker[spacec] = elementchecker[spacec] + cifinfo[d];
      }

      if(cifinfo[d] === ' '){
        spacec = spacec + 1;
      }
      d++;
    }
  }
}
for (let i = 0; i < elementchecker.length; i++){
  remover = elementchecker[i];
  elementchecker[i] = remover.replace('undefined','')
}
console.log(elementchecker)

if (elementchecker[0] !== element1){
  placeholder = element1;
  element1 = element2;
  element2 = placeholder;
  placeholder2 = element1counter;
  element1counter = element2counter;
  element2counter = placeholder2;
}

elementlabel.length = element1counter/2 + element2counter/2;
console.log(elementlabel)
elementlabel.fill(element1, 0, (element1counter/2));
elementlabel.fill(element2, element1counter/2, (element2counter/2)+(element1counter/2))
console.log(elementlabel)
for (let i=0; i < atompos.length; i++){
  rem=i%elementlabel.length
  if (rem === 0){
    atompos[i][3] = elementlabel[0]
  }
  if (rem === 1){
    atompos[i][3] = elementlabel[1]
  }
  if (rem === 2){
    atompos[i][3] = elementlabel[2]
  }
  if (rem === 3){
    atompos[i][3] = elementlabel[3]
  }
  if (rem === 4){
    atompos[i][3] = elementlabel[4]
  }
  if (rem === 5){
    atompos[i][3] = elementlabel[5]
  }
  if (rem === 6){
    atompos[i][3] = elementlabel[6]
  }
  if (rem === 7){
    atompos[i][3] = elementlabel[7]
  }
  if (rem === 8){
    atompos[i][3] = elementlabel[8]
  }
}
 console.log(atompos)



indice2 = '512'
   
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
          
        
        let inputplane = digits(indice2)
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
            text: 'Cmcm '+ '<'+indice2+'>'
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
                title:{text:'<'+indice2+'>' ,fontFamily: 'tahoma',fontSize: 30},
                data: [{
                  type: "scatter",
                  markerColor: "black",
                  toolTipContent: "{label}",
                  dataPoints: trialtrialdatapoints,
                }]
              });
            chart.render();
        chart.render();
  }
  reader.onerror = () => {
    showMessage("Error reading the file. Please try again.", "error");
  };
  reader.readAsText(file);

  
  /*module.exports = atomicposition;*/
//module.exports = atompos

}
// Displays a message to the user
function showMessage(message, type) {
  messageDisplay.textContent = message;
  messageDisplay.style.color = type === "error" ? "red" : "green";
}

//export const atompos = atompostest
//module.exports = atomicposition;
module.exports = atompos
//module.exports = startingvaluematrix;
module.exports = celllengtha;
module.exports = celllengthb;
module.exports = celllengthc;
module.exports = element1;
module.exports = element2;

