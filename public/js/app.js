const tMin = document.getElementById("tMin");
const tMax = document.getElementById("tMax");
const tOp = document.getElementById("tOp");
const delay = document.getElementById("delay");
const powerOnIdle = document.getElementById("powerOnIdle");
const cardConfig = document.getElementById("cardConfig");
const power = document.getElementById("power");
const apply = document.getElementById("apply");
const loadSymbol = document.getElementById("loadSymbol");
var isPowered;

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

function freeze(action){
    loadSymbol.style.display = action ? "block" : "none";
    power.disabled = action;
    apply.disabled = action;
    tMin.disabled = action;
    tMax.disabled = action;
    tOp.disabled = action;
    delay.disabled = action;
    powerOnIdle.disabled = action;
}

function switchPower() {
    console.log("freeze");
    $.ajax({
        beforeSend: freeze(true),
        url: "/power",
        type: "POST", 
        data: {},
        success: postSuccess,
        error : postError
    });

    if (isPowered) {
        powerOff();
    } else {
        powerOn();
    }
}

function validStateParams(params) {
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
    if (params.tOp < params.tMin || params.tOp > params.tMax) {
        return false;
    }
    return true;
}

function postSuccess(data,status) {
    freeze(false);
    window.location.reload();
}
function postError(data,status) {
    freeze(false);
    alert("O ar condionado está demorando muito para responder :(");
    window.location.reload();
}

function sendState() {
    state = {
        "tMin": tMin.value,
        "tMax": tMax.value,
        "tOp": tOp.value,
        "delay": delay.value,
        "powerOnIdle": powerOnIdle.checked
    };
    
    if (validStateParams(state)) {
        console.log("freeze");
        $.ajax({
            beforeSend: freeze(true),
            url: "/state",
            type: "POST", 
            data: state,
            success: postSuccess,
            error : postError
        });
    }
}

function changeRangeVal(id) {
    const curr = document.getElementById(id);
    const currVal = document.getElementById(id+"Val");
    currVal.innerHTML = curr.value;
    if(id==="tMin") setTempMin();
    else if(id=="tMax") setTempMax();
}

function setTempMin() {
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

function setTempMax() {
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

function initValues() {
    initAcState();
    initSensors();
}

function initAcState() {
    $.get('/state', data => {
        isPowered = data.power;
        if (isPowered) {
            powerOn();
        } else {
            powerOff();
        }

        tMin.value = data.tMin;
        changeRangeVal("tMin");
        
        tMax.value = data.tMax;
        changeRangeVal("tMax");
    
        tOp.value = data.tOp;
        changeRangeVal("tOp");
        
        delay.value = data.delay;
        changeRangeVal("delay");

        powerOnIdle.checked = data.powerOnIdle;
    })
}

function initSensors() {
    $.get('/sensors', data => {
        populateSensorList("temp", data.temp);
        populateSensorList("umid", data.umid);
        populateSensorList("luz", data.luz);
        populateSensorList("movimento", data.movimento);
    });
}

setInterval(initSensors, 1000);

function populateSensorList(listName, sensorList) {
    document.getElementById(listName+"_List").innerHTML = '';
    sensorList.forEach((sensor, i) => {
        var element = document.createElement("LI");
        var textnode = document.createTextNode(sensor.name+" : ");
        
        element.appendChild(textnode);
        element.id = listName+"_"+i;
        element.className = "list-subgroup-item";
        
        document.getElementById(listName+"_List").appendChild(element);
        document.getElementById(listName +"_"+i).innerHTML += '<span style="color: blue;">'+sensor.value.toString()+'</span>';        
    });
}
