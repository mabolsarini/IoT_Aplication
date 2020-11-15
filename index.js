const express = require('express');
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

var acState = {
    Power: 0,
    PowerOnIdle: 0,
    TMin: 16,
    TMax: 18,
    Delay: 1,
    Temp: 17
}

function sendMessage(state) {
    console.log(state);
}

function switchAcPower() {
    acState.Power = !acState.Power;
    sendMessage(acState);
}

function updateAcConfig(config) {
    Object.assign(acState, config);
    sendMessage(acState);
}

app.use(express.static('public'));

app.get('/', (req, res) => {
})

app.post('/power', (req, res) => {
    console.log(req.body);
    // switchAcPower();
})

app.post('/config', (req, res) => {
    console.log(req.body);
    // updateAcConfig();
    res.redirect('/');
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