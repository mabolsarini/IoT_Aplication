const tMin = document.getElementById("tMin");
const tMax = document.getElementById("tMax");
const tOp = document.getElementById("tOp");
const delay = document.getElementById("delay");
const cardConfig = document.getElementById("cardConfig");

function submitConfig(){
    if(tMin.value > tMax.value){
        alert("Erro");
        return false;
    }
    return true;
}

function switchPower() {
    $.post(
        "/power",
        {}
    );
    if(ioAc.value == "Ligar"){
        ioAc.value = "Desligar";
        cardConfig.style.display = "block";
    }
    else{
        ioAc.value = "Ligar";
        cardConfig.style.display = "none";
    }
    
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
    
    if (currVal.innerHTML==='<span style="color: red;">Invalido</span>' && tMin.value <= tMax.value){
        currVal.innerHTML = tMin.value;
    } 
    else if(tMin.value > tMax.value) currVal.innerHTML = "<span style='color: red;'>Invalido</span>";
    else if(tMin.value > tOp.value){
        tOp.value = tMin.value;
        changeRangeVal("tOp");
    }
    tOp.min = tMin.value;
}

function setTempMax(){
    const currVal = document.getElementById("tOpVal");

    if (currVal.innerHTML==='<span style="color: red;">Invalido</span>' && tMin.value <= tMax.value){
        currVal.innerHTML = tMax.value;
    }
    else if(tMin.value > tMax.value) currVal.innerHTML = "<span style='color: red;'>Invalido</span>";
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