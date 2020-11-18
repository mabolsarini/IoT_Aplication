const tMin = document.getElementById("tMin");
const tMax = document.getElementById("tMax");
const tOp = document.getElementById("tOp");
const Delay = document.getElementById("delay");
const PowerOnIdle = document.getElementById("powerOnIdle");
const cardConfig = document.getElementById("cardConfig");
const power = document.getElementById("power");
var toSubmit = false;
var isPowered = true;

var sensorsQtty = {
    Temp : 6,
    Umid : 1,
    Lumi : 2,
    Move : 2
}

var sensors = {
    Temp: [0],
    Umid: [0],
    Lumi: [0],
    Move: [0],
}


function submitConfig(){
    toSubmit = false;
    if(document.getElementById("tMinVal").innerHTML != tMin.value) alert("Erro: Temperatura mínima real diferente da temperatua mínima aparente.");
    else if(tMin.value < 16) alert("Erro: Temperatura mínima menor que o mínimo permitido.");
    else if(tMin.value > 22) alert("Erro: Temperatura mínima maior que o máximo permitido.");
    else if(document.getElementById("tMaxVal").innerHTML != tMax.value) alert("Erro: Temperatura maxima real diferente da temperatua maxima aparente.");
    else if(tMax.value < 17) alert("Erro: Temperatura máxima menor que o mínimo permitido.");
    else if(tMax.value > 23) alert("Erro: Temperatura máxima maior que o máximo permitido.");
    else if(document.getElementById("tOpVal").innerHTML != tOp.value) alert("Erro: Valor inválido.");
    else if(tMin.value > tMax.value) alert("Erro: Temperatura mínima maior do que a temperatura máxima.");
    else if(tOp.value>tMax.value) alert("Erro: Temperatura de operação maior do que a temperatura máxima.")
    else if(tOp.value<tMin.value) alert("Erro: Temperatura de operação menor do que a temperatura mínima.")
    else if(document.getElementById("delayVal").innerHTML != delay.value) alert("Erro: Delay real diferente do delay aparente.");
    else if(delay.value < 1) alert("Erro: Delay menor que o mínimo permitido.");
    else if(delay.value > 120) alert("Erro: Delay maior que o máximo permitido.");
    else toSubmit = true;
}

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

function addSensors(name,pos,mocar) {
    var element = document.createElement("LI");
    var textnode = document.createTextNode(pos+" : ");
    element.appendChild(textnode);
    element.id = name +"_"+pos;
    element.className = "list-subgroup-item";
    document.getElementById(name+"_List").appendChild(element);
    if(mocar) document.getElementById(name +"_"+pos).innerHTML += '<span style="color: blue;">'+name[0]+'.'+pos+'</span>';

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
    
    delay.value = 10;
    changeRangeVal("delay");

    for(i=1;i<=sensorsQtty.Temp;i++) addSensors("Temp",i,true);
    for(i=1;i<=sensorsQtty.Umid;i++) addSensors("Umid",i,true);
    for(i=1;i<=sensorsQtty.Lumi;i++) addSensors("Lumi",i,true);
    for(i=1;i<=sensorsQtty.Move;i++) addSensors("Move",i,true);
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