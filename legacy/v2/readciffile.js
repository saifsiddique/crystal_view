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
      if ( cifinfo[i]==='_' && cifinfo[i+2]==='e' && cifinfo[i+6]==='a' && cifinfo[i+12]==='a' && cifinfo[i+13]==='l' && cifinfo[i+20]==='.') {
        cellalphaangle=cifinfo[i+18]+cifinfo[i+19]
        cellalphaangle=Number(cellalphaangle);
        console.log(cellalphaangle)
      }
      if ( cifinfo[i]==='_' && cifinfo[i+2]==='e' && cifinfo[i+6]==='a' && cifinfo[i+12]==='b' && cifinfo[i+13]==='e' && cifinfo[i+19]==='.') {
        cellbetaangle=cifinfo[i+17]+cifinfo[i+18]
        cellbetaangle=Number(cellbetaangle);
        console.log(cellbetaangle)
      }
      if ( cifinfo[i]==='_' && cifinfo[i+2]==='e' && cifinfo[i+6]==='a' && cifinfo[i+12]==='g' && cifinfo[i+13]==='a' && cifinfo[i+20]==='.') {
        cellgammaangle=cifinfo[i+18]+cifinfo[i+19]
        cellgammaangle=Number(cellgammaangle);
        console.log(cellgammaangle)
      }
// Atomic positions

//First atomic position
      if ( cifinfo[i]=== '1' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] !== '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works1')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition1=atomicposition1+cifinfo[k];
          k++;
        }
        atomicposition1=atomicposition1+","
        atomicposition[0]=atomicposition1;
        console.log(atomicposition1)
      }
//Second atomic position
      if ( cifinfo[i]=== '2' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] !== '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works2')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition2=atomicposition2+cifinfo[k];
          k++;
        }
        atomicposition2=atomicposition2+","
        atomicposition[1]=atomicposition2;
        console.log(atomicposition2)
      }
//Third atomic position
      if ( cifinfo[i]=== '3' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] !== '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works3')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition3=atomicposition3+cifinfo[k];
          k++;
        }
        atomicposition3=atomicposition3+","
        atomicposition[2]=atomicposition3;
        console.log(atomicposition3)
      }
//fourth atomic position
      if ( cifinfo[i]=== '4' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] !== '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works4')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition4=atomicposition4+cifinfo[k];
          k++;
        }
        atomicposition4=atomicposition4+","
        atomicposition[3]=atomicposition4;
        console.log(atomicposition4)
      }
//fifth atomic position
      if ( cifinfo[i]=== '5' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] !== '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works5')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition5=atomicposition5+cifinfo[k];
          k++;
        }
        atomicposition5=atomicposition5+","
        atomicposition[4]=atomicposition5;
        console.log(atomicposition5)
      }
//sixth atomic position
      if ( cifinfo[i]=== '6' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] !== '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works6')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition6=atomicposition6+cifinfo[k];
          k++;
        }
        atomicposition6=atomicposition6+","
        atomicposition[5]=atomicposition6;
        console.log(atomicposition6)
      }
//seventh atomic position
      if ( cifinfo[i]=== '7' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] !== '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works7')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition7=atomicposition7+cifinfo[k];
          k++;
        }
        atomicposition7=atomicposition7+","
        atomicposition[6]=atomicposition7;
        console.log(atomicposition7)
      }
//eigth atomic position
      if ( cifinfo[i]=== '8' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] !== '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works8')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition8=atomicposition8+cifinfo[k];
          k++;
        }
        atomicposition8=atomicposition8+","
        atomicposition[7]=atomicposition8;
        console.log(atomicposition8)
      }
//ninth atomic position
      if ( cifinfo[i]=== '9' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] !== '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works9')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition9=atomicposition9+cifinfo[k];
          k++;
        }
        atomicposition9=atomicposition9+","
        atomicposition[8]=atomicposition9;
        console.log(atomicposition9)
      }
//tenth atomic position
      if ( cifinfo[i]=== '0' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] === '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works10')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition10=atomicposition10+cifinfo[k];
          k++;
        }
        atomicposition10=atomicposition10+","
        atomicposition[9]=atomicposition10;
        console.log(atomicposition10)
      }
//eleventh atomic position
      if ( cifinfo[i]=== '1' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] === '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works11')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition11=atomicposition11+cifinfo[k];
          k++;
        }
        atomicposition11=atomicposition11+","
        atomicposition[10]=atomicposition11;
        console.log(atomicposition11)
      }
//twelfth atomic position
      if ( cifinfo[i]=== '2' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] === '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works12')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition12=atomicposition12+cifinfo[k];
          k++;
        }
        atomicposition12=atomicposition12+","
        atomicposition[11]=atomicposition12;
        console.log(atomicposition12)
      }
//thirteenth atomic position
      if ( cifinfo[i]=== '3' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] === '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works13')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition13=atomicposition13+cifinfo[k];
          k++;
        }
        atomicposition13=atomicposition13+","
        atomicposition[12]=atomicposition13;
        console.log(atomicposition13)
      }
//fourteenth atomic position
      if ( cifinfo[i]=== '4' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] === '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works14')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition14=atomicposition14+cifinfo[k];
          k++;
        }
        atomicposition14=atomicposition14+","
        atomicposition[13]=atomicposition14;
        console.log(atomicposition14)
      }
//fifteenth atomic position
      if ( cifinfo[i]=== '5' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] === '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works15')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition15=atomicposition15+cifinfo[k];
          k++;
        }
        atomicposition15=atomicposition15+","
        atomicposition[14]=atomicposition15;
        console.log(atomicposition15)
      }
//sixteenth atomic position
      if ( cifinfo[i]=== '6' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] === '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works16')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition16=atomicposition16+cifinfo[k];
          k++;
        }
        atomicposition16=atomicposition16+","
        atomicposition[15]=atomicposition16;
        console.log(atomicposition16)
      }
//seventeenth atomic position
      if ( cifinfo[i]=== '7' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] === '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works17')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition17=atomicposition17+cifinfo[k];
          k++;
        }
        atomicposition17=atomicposition17+","
        atomicposition[16]=atomicposition17;
        console.log(atomicposition17)
      }
//eighteenth atomic position
      if ( cifinfo[i]=== '8' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] === '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works18')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition18=atomicposition18+cifinfo[k];
          k++;
        }
        atomicposition18=atomicposition18+","
        atomicposition[17]=atomicposition18;
        console.log(atomicposition18)
      }
//ninteenth atomic position
      if ( cifinfo[i]=== '9' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] !== '2' && cifinfo[(i-1)] === '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works18')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition19=atomicposition19+cifinfo[k];
          
          k++;
        }
        atomicposition19=atomicposition19+","
        atomicposition[18]=atomicposition19;
        console.log(atomicposition19)
      }
//twentieth atomic position
      if ( cifinfo[i]=== '0' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] === '2' && cifinfo[(i-1)] !== '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works20')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition20=atomicposition20+cifinfo[k];
          k++;
        }
        atomicposition20=atomicposition20+","
        atomicposition[19]=atomicposition20;
        console.log(atomicposition20)
      }
//twenty-oneth atomic position
      if ( cifinfo[i]=== '1' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] === '2' && cifinfo[(i-1)] !== '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works21')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition21=atomicposition21+cifinfo[k];
          k++;
        }
        atomicposition21=atomicposition21+","
        atomicposition[20]=atomicposition21;
        console.log(atomicposition21)
      }
//twenty-twoth atomic position
      if ( cifinfo[i]=== '2' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] === '2' && cifinfo[(i-1)] !== '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works22')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition22=atomicposition22+cifinfo[k];
          k++;
        }
         atomicposition22=atomicposition22+","
         atomicposition[21]=atomicposition22;
        console.log(atomicposition22)
      }
//twenty-threeth atomic position
      if ( cifinfo[i]=== '3' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] === '2' && cifinfo[(i-1)] !== '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works23')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition23=atomicposition23+cifinfo[k];
          k++;
        }
         atomicposition23=atomicposition23+","
         atomicposition[22]=atomicposition23;
        console.log(atomicposition23)
      }
//twenty-fourth atomic position
      if ( cifinfo[i]=== '4' && cifinfo[i+2]=== "'" && cifinfo[(i-1)] === '2' && cifinfo[(i-1)] !== '1' && (cifinfo[i+3]==='-' || cifinfo[i+3] ==='x')) {
        console.log('works24')
        let k = i+3;
        while (cifinfo[k] !== "'"){
          atomicposition24=atomicposition24+cifinfo[k];
          k++;
        }
        atomicposition24=atomicposition24+","
        atomicposition[23]=atomicposition24;
        console.log(atomicposition24)
      }
    }
      
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
          if(spacce === ((rowcounter)*(8)+(4))){
            console.log('works')
            let r=p+1;
            while(cifinfo[r] !== ' '){
              startingvaluematrix[rowcounter][1] = startingvaluematrix[rowcounter][1] + cifinfo[r];
              r=r+1;
            }
          }
          if(spacce === ((rowcounter)*(8)+5)){
            let r=p+1;
            while(cifinfo[r] !== ' '){
              startingvaluematrix[rowcounter][2] = startingvaluematrix[rowcounter][2] + cifinfo[r];
              r=r+1;
            }
          }
          if(spacce === ((rowcounter)*(8)+6)){
            let r=p+1;
            while(cifinfo[r] !== ' '){
              startingvaluematrix[rowcounter][3] = startingvaluematrix[rowcounter][3] + cifinfo[r];
              r=r+1;
            }
          

          }
          p=p+1;
          

        }
        }
}
console.log(startingvaluematrix)

console.log(startingvaluematrix[1][1])
console.log(cellgammaangle)
console.log(atomicposition.length)

var atompos = [];
for(var i=0; i<(atomicposition.length); i++) {
    atompos[i] = [];
    for(var j=0; j<2; j++) {
        atompos[i][j] = [];
    }
}


u=0;
console.log(atompos)

let tentcount=0;
for (let u = 0; u < (atomicposition.length-1); u++){
  
  if( tentcount === 0){
    let f=0;
    tentcount = 1;
    let commacounter=0;
    while(commacounter < 3){
      if(atomicposition[u][f] ===','){
        commacounter=commacounter+1;
      }
      //XXX
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && commacounter === 0 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[0][1]
        atompos[u][0] = Number(ph)
        
        atompos[u][0] = -atompos[u][0]
        console.log(atompos[u][0])
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && commacounter === 0 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[0][1]
        atompos[u][0] = Number(ph)
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && commacounter === 0 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[0][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = -atompos[u][0] + 0.5;
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && commacounter === 0 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
       let ph=startingvaluematrix[0][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = atompos[u][0] + 0.5;
      }

      //YYY
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && commacounter === 1 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[0][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1]
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && commacounter === 1 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[0][2]
        atompos[u][1] = Number(ph)
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && commacounter === 1 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
       let ph=startingvaluematrix[0][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1] + 0.5;
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && commacounter === 1 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[0][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = atompos[u][1] + 0.5;
      }

      //ZZZ
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && commacounter === 2 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[0][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2]
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && commacounter === 2 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[0][3]
        atompos[u][2] = Number(ph)
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && commacounter === 2 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[0][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2] + 0.5;
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && commacounter === 2 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[0][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = atompos[u][2] + 0.5;
      }
      f=f+1;
    }
  
}
else if(atomicposition[u] !== '' && tentcount === 1){
    let f=0;
    tentcount = 2;
    let commacounter=0;
    while(commacounter < 3){
      if(atomicposition[u][f] ===','){
        commacounter=commacounter+1;
      }
      //XXX
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && commacounter === 0 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[1][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = -atompos[u][0]
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && commacounter === 0 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[1][1]
        atompos[u][0] = Number(ph)
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && commacounter === 0 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[1][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = -atompos[u][0] + 0.5;
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && commacounter === 0 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[1][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = atompos[u][0] + 0.5;
      }

      //YYY
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && commacounter === 1 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[1][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1]
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && commacounter === 1 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[1][2]
        atompos[u][1] = Number(ph)
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && commacounter === 1 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[1][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1] + 0.5;
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && commacounter === 1 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[1][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = atompos[u][1] + 0.5;
      }

      //ZZZ
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && commacounter === 2 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[1][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2]
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && commacounter === 2 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[1][3]
        atompos[u][2] = Number(ph)
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && commacounter === 2 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[1][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2] + 0.5;
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && commacounter === 2 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[1][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = atompos[u][2] + 0.5;
      }
      f=f+1;
    }
    
  
}

else if(atomicposition[u] !== '' && tentcount === 2){
    let f=0;
    tentcount = 3;
    let commacounter=0;
    while(commacounter < 3){
      if(atomicposition[u][f] ===','){
        commacounter=commacounter+1;
      }
      //XXX
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && commacounter === 0 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[2][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = -atompos[u][0]
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && commacounter === 0 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[2][1]
        atompos[u][0] = Number(ph)
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && commacounter === 0 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[2][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = -atompos[u][0] + 0.5;
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && commacounter === 0 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[2][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = atompos[u][0] + 0.5;
      }

      //YYY
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && commacounter === 1 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[2][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1]
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && commacounter === 1 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[2][2]
        atompos[u][1] = Number(ph)
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && commacounter === 1 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[2][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1] + 0.5;
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && commacounter === 1 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[2][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = atompos[u][1] + 0.5;
      }

      //ZZZ
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && commacounter === 2 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[2][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2]
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && commacounter === 2 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[2][3]
        atompos[u][2] = Number(ph)
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && commacounter === 2 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[2][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2] + 0.5;
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && commacounter === 2 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[2][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = atompos[u][2] + 0.5;
      }
      f=f+1;
    }
    
  
}


else if(atomicposition[u] !== '' && tentcount === 3){
    let f=0;
    tentcount = 0;
    let commacounter=0;
    while(commacounter < 3){
      if(atomicposition[u][f] ===','){
        commacounter=commacounter+1;
      }
      //XXX
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && commacounter === 0 && atomicposition[u][f+1] === ','){
       let ph=startingvaluematrix[3][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = -atompos[u][0]
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && commacounter === 0 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[3][1]
        atompos[u][0] = Number(ph)
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] === '-' && commacounter === 0 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[3][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = -atompos[u][0] + 0.5;
      }
      if (atomicposition[u][f] === 'x' && atomicposition[u][f-1] !== '-' && commacounter === 0 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[3][1]
        atompos[u][0] = Number(ph)
        atompos[u][0] = atompos[u][0] + 0.5;
      }

      //YYY
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && commacounter === 1 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[3][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1]
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && commacounter === 1 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[3][2]
        atompos[u][1] = Number(ph)
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] === '-' && commacounter === 1 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[3][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = -atompos[u][1] + 0.5;
      }
      if (atomicposition[u][f] === 'y' && atomicposition[u][f-1] !== '-' && commacounter === 1 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
       let ph=startingvaluematrix[3][2]
        atompos[u][1] = Number(ph)
        atompos[u][1] = atompos[u][1] + 0.5;
      }

      //ZZZ
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && commacounter === 2 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[3][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2]
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && commacounter === 2 && atomicposition[u][f+1] === ','){
        let ph=startingvaluematrix[3][3]
        atompos[u][2] = Number(ph)
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] === '-' && commacounter === 2 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[3][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = -atompos[u][2] + 0.5;
      }
      if (atomicposition[u][f] === 'z' && atomicposition[u][f-1] !== '-' && commacounter === 2 && atomicposition[u][f+1]+atomicposition[u][f+2]+atomicposition[u][f+3]+atomicposition[u][f+4] === '+1/2'){
        let ph=startingvaluematrix[3][3]
        atompos[u][2] = Number(ph)
        atompos[u][2] = atompos[u][2] + 0.5;
        module.exports = atompos;
      }
      f=f+1;
    }
    
  
}

};

console.log(atompos)
  }
  reader.onerror = () => {
    showMessage("Error reading the file. Please try again.", "error");
  };
  reader.readAsText(file);

  
  module.exports = atomicposition;

}

// Displays a message to the user
function showMessage(message, type) {
  messageDisplay.textContent = message;
  messageDisplay.style.color = type === "error" ? "red" : "green";
}

module.exports = atomicposition;
module.exports = startingvaluematrix;
module.exports = celllengtha;

