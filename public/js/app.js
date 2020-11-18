const tMin = document.getElementById("tMin");
const tMax = document.getElementById("tMax");
const tOp = document.getElementById("tOp");
const Delay = document.getElementById("Delay");
const PowerOnIdle = document.getElementById("PowerOnIdle");
const cardConfig = document.getElementById("cardConfig");

function validConfig(params) {
    if (params.tMin < 16 || params.tMin > 22) {
        return false;
    }
    if (params.tMax < 17 || params.tMax > 23) {
        return false;
    }
    if (params.tMax < params.tMin) {
        return false;
    }
    if (params.Delay < 1 || params.Delay > 120) {
        return false;
    }
    if (params.tOp < 16 || params.tOp > 23) {
        return false;
    }
    return true;
}

function submitConfig() {
    config = {
        "PowerOnIdle": PowerOnIdle.value,
        "tMin": tMin.value,
        "tMax": tMax.value,
        "tOp": tOp.value,
        "Delay": Delay.value
    }

    console.log(config);

    if(validConfig(config)) {
        $.post(
            "/state",
            config
        );
    } else {
        alert("Por favor, insira uma configuração válida.");
        return false;        
    }
    return true;
}

function switchPower() {
    $.post(
        "/power"
    );
    if(power.value == "Ligar"){
        power.value = "Desligar";
        cardConfig.style.display = "block";
    }
    else{
        power.value = "Ligar";
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
    
    Delay.value = 10;
    changeRangeVal("Delay");

}