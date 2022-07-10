import jamulusRpcInterface from './jamulusrpcclient/RPCmodule.mjs';
import fs from 'fs';
import path from 'path';
const RPC = new jamulusRpcInterface(process.argv.rpcPort || 8765, process.argv.rpcSecretFilePath || '/var/opt/jamulusRPCsecret.txt');
const chatRegExp = new RegExp(/(^<font color=".*">\(.*\) <b>.*<\/b><\/font> )/);
const jambotRegExp = new RegExp(/^\/jambot /gi);
const id = 'CHATBOT';
let books ={};

function searchTune(tune) {
    let result = '<table>';
    let searchString = '';
    tune.forEach( word => {
        if (word !== '') searchString += '(?=.*' + word + ')';
    })
    let search = new RegExp(searchString, 'gi');
    console.log(search);
    Object.keys(books).forEach(book => {
        books[book].forEach( song => {
            if (search.test(song)) {
                result += '<tr><td><b>' + book + '</b></td><td>' + song + '</td></tr>';
            }
        });
    });
    result += '</table>';
    console.log(result);
    return result;
}

function parseNdJson(ndJson) {
    ndJson = ndJson.toString().split('\n');
    ndJson.pop();
    return ndJson;
}

RPC.jamRPCServer.on('data', (data) => {
    data = parseNdJson(data);
    data.forEach ( row => {
        let parsed = JSON.parse(row);
        if (parsed.id) return;
        if (parsed.method) {
            if (parsed.method === 'jamulusserver/chatMessageReceived') {
                let message = parsed.params.chatMessage.split(chatRegExp)[2];
                if (jambotRegExp.test(message)) {
                    let command = message.split(' ');
                    command.shift();
                    let request = `{"id":"${id}","jsonrpc":"2.0","method":"jamulusserver/broadcastChatMessage","params":{"chatMessage":"<h3>jambot received command: ${command}"}}\n`;
                    switch (command.shift()) {
                        case 'search':
                            console.log(`searching string: ${command}`);
                            let index = searchTune(command);
                            request = `{"id":"${id}","jsonrpc":"2.0","method":"jamulusserver/broadcastChatMessage","params":{"chatMessage":"${index}"}}\n`;
                            break;
                        default:
                            console.log(command);
                            break;
                    }
                    RPC.jamRPCServer.write(request);
                }
            }
        }
    })
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
