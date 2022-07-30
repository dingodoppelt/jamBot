import jamulusRpcInterface from './jamulusrpcclient/RPCmodule.mjs';
import fs from 'fs';
import path from 'path';
const RPC = new jamulusRpcInterface(process.argv.rpcPort || 8765, process.argv.rpcSecretFilePath || '/var/opt/jamulusRPCsecret.txt');
const chatRegExp = new RegExp(/(^<font color=".*">\(.*\) <b>.*<\/b><\/font> )/);
const jambotRegExp = new RegExp(/\/jambot /i);
const id = 'CHATBOT';
const jokesFile = './jokes';
let books ={};
let partJson = {};
const jokes = fs.readFileSync(jokesFile, "utf-8").split('\n');

function searchTune(tune) {
    let result = '<table border=\'1\' cellpadding=\'4\'><tr><th><b><u>Book</u></b></th><th><b><u>Title, Pages</u></b></th></tr>';
    let searchString = '';
    tune.forEach( word => {
        if (word !== '') searchString += '(?=.*' + word.replace(/\n/g, '') + ')';
    })
    let search = new RegExp(searchString, 'gi');
    Object.keys(books).forEach(book => {
        books[book].forEach( song => {
            if (search.test(song)) {
                result += '<tr><td><b>' + book + '</b></td><td>' + song.replace(/"/g, '\'').replace(/,/g,' ') + '</td></tr>';
            }
        });
    });
    result += '</table>';
    return result;
}

function suggestTune() {
    let book = Object.keys(books);
    let randomBook = book[Math.floor(Math.random() * book.length)];
    return books[randomBook][Math.floor(Math.random() * books[randomBook].length)].split(',').shift().split(' ');
}

function getRandomJoke(){
    return jokes[Math.floor(Math.random()*jokes.length)].replace(/"/g, '\'');
}

function parseNdJson(ndJson) {
    ndJson = ndJson.toString().split('\n');
    ndJson.pop();
    return ndJson;
}

RPC.jamRPCServer.on('data', (data) => {
    let parsed = {};
    console.log(data.toString());
    data = parseNdJson(data);
    for (const row of data) {
        if (row && !row.error) {
            try {
                parsed = JSON.parse(row);
            } catch (e) {
                if (e instanceof SyntaxError) {
                    if (e.message.split(' ')[1] == 'end') {
                        console.log(`${e.name}: ${e.message}`);
                        partJson = row;
                        continue;
                    }
                    else if (e.message.split(' ')[1] == 'token') {
                        console.log(`${e.name}: ${e.message}`);
                        partJson += row;
                        try {
                            parsed = JSON.parse(partJson);
                            partJson = '';
                            console.log('successfully parsed')
                        } catch (e) {
                            continue;
                        }
                    }
                }
            }
        }
    }
    if (parsed.id) return;
    if (parsed.method && parsed.method === 'jamulusserver/chatMessageReceived') {
        if (jambotRegExp.test(parsed.params.chatMessage)) {
            let message = parsed.params.chatMessage.split(jambotRegExp)[1];
            let command = message.split(' ');
            let request = `{"id":"${id}","jsonrpc":"2.0","method":"jamulusserver/broadcastChatMessage","params":{"chatMessage":"<h3>jambot received command: ${command}"}}\n`;
            switch (command.shift()) {
                case 'search':
                    let index = searchTune(command);
                    request = `{"id":"${id}","jsonrpc":"2.0","method":"jamulusserver/broadcastChatMessage","params":{"chatMessage":"${index}"}}\n`;
                    break;
                case 'suggest':
                    let randTune = suggestTune();
                    console.log(randTune);
                    let tune = searchTune(randTune);
                    request = `{"id":"${id}","jsonrpc":"2.0","method":"jamulusserver/broadcastChatMessage","params":{"chatMessage":"${tune}"}}\n`;
                    break;
                case 'joke':
                    let joke = getRandomJoke();
                    request = `{"id":"${id}","jsonrpc":"2.0","method":"jamulusserver/broadcastChatMessage","params":{"chatMessage":"<b>Here's one:</b><br>${joke}"}}\n`;
                    break;
                case 'help':
                    request = `{"id":"${id}","jsonrpc":"2.0","method":"jamulusserver/broadcastChatMessage","params":{"chatMessage":"<b>Hi, I'm jambot and I know these commands:<br>/jambot joke<br>/jambot search [jazz standard title]<br>/jambot suggest</b>"}}\n`;
                    break;
                default:
                    console.log(command);
                    break;
            }
            console.log(request);
            RPC.jamRPCServer.write(request);
        }
    }
});

fs.readdir('./book-indices/', (err, files) => {
    files.forEach(file => {
        if (path.extname(file) == ".csv") {
            fs.readFile('./book-indices/' + file, 'utf8', (err, data) => {
                books[path.basename(file, '.csv')] = data.split('\n');
            })
        }
    });
});
