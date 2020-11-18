const express = require('express');
const bodyParser = require("body-parser");
const mqtt = require('mqtt');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

const config = {
    hostname: '127.0.0.1',
    port: 8080,
    brokerEndpoint: 'andromedalasdpc.icmc.usp.br:1821'
}
const broker = mqtt.connect('mqtt://'+config.brokerEndpoint);

// Mock do estado
var acState = {
    power: true,
    powerOnIdle: true,
    tMin: 16,
    tMax: 18,
    tOp: 17,
    delay: 10,
}

// topico sala_ID/type/sensor_ID
// temp {“s”:”dd/mm/aaaa hh:mm:ss”,”0”:21,“temp”:xx}
// umid {“s”:”dd/mm/aaaa hh:mm:ss”,”0”:29,“umid”:xx}
// luz {“s”:”dd/mm/aaaa hh:mm:ss”,“21”:x,”0”:26}
// movimento  {“s”:”dd/mm/aaaa hh:mm:ss”,”0”:32}

var sensors = [
    {name: "20", type: "temp", value: "20.0"},
    {name: "21", type: "temp", value: "21.0"},
    {name: "22", type: "temp", value: "22.0"},
    {name: "20", type: "umid", value: "20.1"},
    {name: "21", type: "umid", value: "21.1"},
    {name: "22", type: "umid", value: "22.1"},
    {name: "26", type: "luz", value: "26.0"},
    {name: "25", type: "movimento", value: "25.0"}
];

function castStateParams(reqBody) {
    return {
        tMin: parseInt(reqBody.tMin),
        tMax: parseInt(reqBody.tMax),
        tOp: parseInt(reqBody.tOp),
        delay: parseInt(reqBody.delay),
        powerOnIdle: (reqBody.powerOnIdle === 'true')
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
    if (params.tOp < 16 || params.tOp > 23) {
        return false;
    }
    return true;
}

function setAcState(state, params) {
    Object.keys(params).forEach( key => {
        if (key in state) {
            state[key] = params[key];
        }
    })
    return state;
}

function switchAcPower(state) {
    state.power = !state.power;
    return state;
}

function sendMessage(msg) {
    console.log("Sent message "+msg);
}

function logState(msg) {
    var now = new Date();
    console.log(now.toISOString()+" "+msg+": "+JSON.stringify(acState));
}

// Roteamento

app.route('/state')
    .get((req, res) => {
        res.send(acState);
    })
    .post((req, res) => {        
        params = castStateParams(req.body);

        if (validStateParams(params)) {
            setAcState(acState, params);

            logState("Novo estado recebido");
            res.status(200);
        } else {
            logState("Configuracao de estado invalida recebida");
            res.sendStatus(400);
        }
    })
;

app.get('/sensors', (req, res) => {
    res.send(sensors);
})
    
app.post('/power', (req, res) => {
    acState = switchAcPower(acState);

    logState("Novo estado recebido");
    res.status(200);
})

app.use(function(req, res, next) {
    res.status(404).send('Página não foi encontrada.');
});

app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Houve um problema interno no servidor.');
});

http.listen(config.port, () => {
  console.log(`Servidor da aplicacao rodando em http://localhost:${config.port}`)
})