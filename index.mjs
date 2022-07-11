import jamulusRpcInterface from './jamulusrpcclient/RPCmodule.mjs';
import fs from 'fs';
import path from 'path';
const RPC = new jamulusRpcInterface(process.argv.rpcPort || 8765, process.argv.rpcSecretFilePath || '/var/opt/jamulusRPCsecret.txt');
const chatRegExp = new RegExp(/(^<font color=".*">\(.*\) <b>.*<\/b><\/font> )/);
const jambotRegExp = new RegExp(/\/jambot /i);
const id = 'CHATBOT';
let books ={};
let partJson = {};

function searchTune(tune) {
    let result = '<table style=\'border:1px solid;width:100%\'><tr><th><b><u>Book</u></b></th><th><u>Title, Pages</u></th></tr>';
    let searchString = '';
    tune.forEach( word => {
        if (word !== '') searchString += '(?=.*' + word + ')';
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
