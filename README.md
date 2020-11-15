# IoT_Aplication

# NodeJS + Express (Servidor)
https://nodejs.org/
https://expressjs.com/
https://developer.mozilla.org/pt-BR/docs/Learn/Server-side/Express_Nodejs/Introdu%C3%A7%C3%A3o

# Lib para MQTT (Interagir com o Broker)
https://github.com/mqttjs/MQTT.js

# Ajax e Socket.io para atualização dinâmica da página
https://api.jquery.com/jquery.ajax/
https://socket.io/

# Dados

- time_ID: 1
- Ar condicionado: 23
- Sensores de temperatura: 20, 21, 22
- Sensores de umidade: 20, 21, 22
- Sensor de luminosidade: 26
- Sensor de movimento: 25

# Broker:
- Endpoint: andromeda.lasdpc.icmc.usp.br
- Port 1821/8021

# TODO

- BACKEND (index.js):
    - Comunicação com o Broker
        - Usar lib MQTT

    - Criar uma rota para servir os dados dos sensores, atualizando constantemente

    - Terminar a rota de atualização de configuração
    - Terminar a rota de ligar/desligar
    - Se der, adicionar autenticação (login, usuario, senha, etc). Tem módulos no Node que abstraem tudo isso pra a gente.
    - Mudar o tráfego de http para https 


- FRONTEND (/public/):
    - Mostrar e atualizar constantemente os valores em "Monitoramento dos sensores" dinamicamente
        - Buscar em alguma rota definida no servidor
        - Atualizar na página usando Ajax e uma conexão Socket.io

    - Terminar o formulário de configuração
        - O botão de desligar deve disparar a rota "/power" (POST)
            - Não precisa de valores no corpo da requisição, só precisa da requisição pra disparar a funções de ligar/desligar no backend
            - Se der, fazer um botão dinâmico que muda seu valor entre "ligar" e "desligar"
            - Se der, fazer o resto do formulário sumir se o ar condicionado estiver desligado
        
        - O botão de atualizar os valores deve disparar a rota "/config" (POST)
            - Deve levar os valores dos campos do forms no corpo da requisição
    
    - Deixar a página bonita (html e css)