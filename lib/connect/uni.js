'use strict'

/* global uni */
var socketOpen = false
var socketMsgQueue = []


function sendSocketMessage(msg) {
    if (socketOpen) {
        uni.sendSocketMessage({
            data: msg
        });
    } else {
        socketMsgQueue.push(msg);
    }
}

function WebSocket(url, protocols) {
    var ws = {
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3,
        readyState: socketOpen ? 1 : 0,
        send: sendSocketMessage,
        close: uni.closeSocket,
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null
    }

    uni.connectSocket({
        url: url,
        protocols:protocols
    });

    uni.onSocketOpen(function (res) {
        console.log('WebSocket连接已打开！');
        ws.readyState = ws.OPEN
        socketOpen = true;
        for (var i = 0; i < socketMsgQueue.length; i++) {
            sendSocketMessage(socketMsgQueue[i]);
        }
        socketMsgQueue = [];

        ws.onopen && ws.onopen.apply(ws, arguments)
    });

    uni.onSocketMessage(function (res) {
        console.log('收到服务器内容：' + res.data);
        ws.onmessage && ws.onmessage.apply(ws, arguments)
    });

    uni.onSocketClose(function (res) {
        console.log('WebSocket 已关闭！');
        ws.onclose && ws.onclose.apply(ws, arguments)
        ws.readyState = ws.CLOSED
        socketOpen = false
    });

    uni.onSocketError(function (res) {
        console.log('WebSocket连接打开失败，请检查！');
        ws.onerror && ws.onerror.apply(ws, arguments)
        ws.readyState = ws.CLOSED
        socketOpen = false
    });

    return ws
}

var websocket = require('websocket-stream')
var urlModule = require('url')

function buildUrl(opts, client) {
    var protocol = opts.protocol === 'wxs' ? 'wss' : 'ws'
    var url = protocol + '://' + opts.hostname + ':' + opts.port + opts.path
    if (typeof (opts.transformWsUrl) === 'function') {
        url = opts.transformWsUrl(url, opts, client)
    }
    return url
}

function setDefaultOpts(opts) {
    if (!opts.hostname) {
        opts.hostname = 'localhost'
    }
    if (!opts.port) {
        if (opts.protocol === 'wss') {
            opts.port = 443
        } else {
            opts.port = 80
        }
    }
    if (!opts.path) {
        opts.path = '/'
    }

    if (!opts.wsOptions) {
        opts.wsOptions = {}
    }
}

function createWebSocket(client, opts) {
    var websocketSubProtocol =
        (opts.protocolId === 'MQIsdp') && (opts.protocolVersion === 3)
            ? 'mqttv3.1'
            : 'mqtt'

    setDefaultOpts(opts)
    var url = buildUrl(opts, client)
    return websocket(WebSocket(url, [websocketSubProtocol]))
}

function buildBuilder(client, opts) {
    if (!opts.hostname) {
        opts.hostname = opts.host
    }

    if (!opts.hostname) {
        // Throwing an error in a Web Worker if no `hostname` is given, because we
        // can not determine the `hostname` automatically.  If connecting to
        // localhost, please supply the `hostname` as an argument.
        if (typeof (document) === 'undefined') {
            throw new Error('Could not determine host. Specify host manually.')
        }
        var parsed = urlModule.parse(document.URL)
        opts.hostname = parsed.hostname

        if (!opts.port) {
            opts.port = parsed.port
        }
    }
    return createWebSocket(client, opts)
}

module.exports = buildBuilder