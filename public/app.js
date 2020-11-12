'use strict';

const si = document.getElementById("Sign_In");
const su = document.getElementById("Sign_Up");
const es = document.getElementById("Esqueci_a_senha")

function setToNone(){
    si.style.display = "none";
    su.style.display = "none";
    es.style.display = "none";
}

function myFunction_SI() {
    if (si.style.display === "none") {
      si.style.display = "block";
      su.style.display = "none";
      es.style.display = "none";
    }
    else setToNone();
}
function myFunction_SU() {
    if (su.style.display === "none") {
      si.style.display = "none";
      su.style.display = "block";
      es.style.display = "none";
    }
    else setToNone();
}
function myFunction_ES() {
    if (es.style.display === "none") {
      si.style.display = "none";
      su.style.display = "none";
      es.style.display = "block";
    }
    else setToNone();
}
