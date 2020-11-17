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
}

function iniValues(){
    tMinVal.innerHTML = 19;
    tMaxVal.innerHTML = 20;
    delayVal.innerHTML = 61;
}