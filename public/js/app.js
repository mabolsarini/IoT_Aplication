const tMin = document.getElementById("tMin");
const tMax = document.getElementById("tMax");
const tOp = document.getElementById("tOp");
const delay = document.getElementById("delay");
function switchPower() {
    $.post(
        "/power",
        {}
    );
    ioAc.value == "Ligar" ? ioAc.value = "Desligar" : ioAc.value = "Ligar";
    return true;
}

function changeRangeVal(id){
    const curr = document.getElementById(id);
    const currVal = document.getElementById(id+"Val");
    currVal.innerHTML = curr.value;
    if(id==="tMin") setTempMin();
    else if(id=="tMax") setTempMax();
}

function setTempMin(){
    const currVal = document.getElementById("tOpVal");
    
    if (currVal.innerHTML==="Invalido" && tMin.value <= tMax.value) currVal.innerHTML = tMin.value; 
    else if(tMin.value > tMax.value) currVal.innerHTML = "Invalido";
    else if(tMin.value > tOp.value){
        tOp.value = tMin.value;
        changeRangeVal("tOp");
    }
    tOp.min = tMin.value;
}

function setTempMax(){
    const currVal = document.getElementById("tOpVal");

    if (currVal.innerHTML==="Invalido" && tMin.value <= tMax.value) currVal.innerHTML = tMax.value; 
    else if(tMin.value > tMax.value) currVal.innerHTML = "Invalido";
    else if(tMax.value < tOp.value){
        tOp.value = tMax.value;
        changeRangeVal("tOp");
    }
    tOp.max = tMax.value;
}


function iniValues(){
    tMin.value = 16;
    changeRangeVal("tMin");
    
    tMax.value = 18;
    changeRangeVal("tMax");

    tOp.value = 17;
    changeRangeVal("tOp");
    
    delay.value = 10;
    changeRangeVal("delay");

}