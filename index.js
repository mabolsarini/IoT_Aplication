const express = require('express');
const bodyParser = require("body-parser");
const mqtt = require('mqtt');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const config = {
    hostname: '127.0.0.1',
    port: 8080,
    brokerEndpoint: 'andromedalasdpc.icmc.usp.br:1821'
}
const broker = mqtt.connect('mqtt://'+config.brokerEndpoint);

// Mock do estado
var acState = {
    Power: true,
    PowerOnIdle: true,
    tMin: 16,
    tMax: 18,
    tOp: 17,
    Delay: 1,
}

var sensors = {
    Lumi: 1,
    Umi: 2,
    Move: 3,
    Temp: 4
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
    delete params["Power"];

    Object.keys(params).forEach( key => {
        if (key in state) {
            state[key] = params[key];
        }
    })
    return state;
}

function switchAcPower(state) {
    state.Power = !state.Power;

    return state;
}

function sendMessage(msg) {
    console.log("Sent message "+msg);
}

// Roteamento
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.route('/state')
    .get((req, res) => {
        res.send(acState);
    })
    .post((req, res) => {
        var params = req.body;
        if (validStateParams(params)) {
            setAcState(acState, params);
            res.redirect('/');
        } else {
            res.sendStatus(400);
        }
    })
;

app.get('/sensors', (req, res) => {
    res.send(sensors);
})
    
app.post('/power', (req, res) => {
    switchAcPower(acState);
    res.sendStatus(200);
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