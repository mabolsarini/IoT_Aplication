const tMin = document.getElementById("tMin");
const tMax = document.getElementById("tMax");
const tOp = document.getElementById("tOp");
const Delay = document.getElementById("delay");
const PowerOnIdle = document.getElementById("powerOnIdle");
const cardConfig = document.getElementById("cardConfig");
var isPowered;
var sensors;

function powerOff() {
    isPowered = false;
    power.value = "Ligar";
    cardConfig.style.display = "none";
}

function powerOn() {
    isPowered = true;
    power.value = "Desligar";
    cardConfig.style.display = "block";
}

function switchPower() {
    $.post(
        "/power"
    );

    if (isPowered) {
        powerOff();
    } else {
        powerOn();
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


function initValues(){
    $.get('/state', data => {
        isPowered = data.Power;
        if (isPowered) {
            powerOn();
        } else {
            powerOff();
        }

        tMin.value = data.tMin;
        changeRangeVal("tMin");
        
        tMax.value = data.tMax;
        changeRangeVal("tMax");
    
        tOp.value = data.tMop;
        changeRangeVal("tOp");
        
        Delay.value = data.Delay;
        changeRangeVal("delay");
    
        PowerOnIdle.checked = data.PowerOnIdle;
    });

    $.get('/sensors', data => {
        updateSensorValues(data);
    });
}
function updateSensorValues(data) {
    for(i=1; i<=data.Temp.length; i++) {
        document.getElementById("Temp_"+i).innerHTML += '<span style="color: blue;">'+ data.Temp[i-1] + '</span>';
    }
    for(i=1; i<=data.Umid.length; i++) {
        document.getElementById("Umid_"+i).innerHTML += '<span style="color: blue;">'+ data.Umid[i-1] + '</span>';    
    }
    for(i=1; i<=data.Lumi.length; i++) {
        document.getElementById("Lumi_"+i).innerHTML += '<span style="color: blue;">'+ data.Lumi[i-1] + '</span>';
    }
    for(i=1; i<=data.Move.length; i++) {
        document.getElementById("Move_"+i).innerHTML += '<span style="color: blue;">'+ data.Move[i-1] + '</span>';
    }
}