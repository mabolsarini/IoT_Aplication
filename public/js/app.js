const tMin = document.getElementById("tMin");
const tMax = document.getElementById("tMax");
const tOp = document.getElementById("tOp");
const delay = document.getElementById("delay");
const cardConfig = document.getElementById("cardConfig");
var toSubmit = false;

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

function addSensors(name,pos,mocar) {
    var element = document.createElement("LI");
    var textnode = document.createTextNode(pos+" : ");
    element.appendChild(textnode);
    element.id = name +"_"+pos;
    element.className = "list-subgroup-item";
    document.getElementById(name+"_List").appendChild(element);
    if(mocar) document.getElementById(name +"_"+pos).innerHTML += '<span style="color: blue;">'+name[0]+'.'+pos+'</span>';

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

    for(i=1;i<=sensorsQtty.Temp;i++) addSensors("Temp",i,true);
    for(i=1;i<=sensorsQtty.Umid;i++) addSensors("Umid",i,true);
    for(i=1;i<=sensorsQtty.Lumi;i++) addSensors("Lumi",i,true);
    for(i=1;i<=sensorsQtty.Move;i++) addSensors("Move",i,true);

}