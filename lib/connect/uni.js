'use strict'

var Transform = require('readable-stream').Transform
var duplexify = require('duplexify')

import Vue from 'vue'
import store from "./store.js"; //引入vuex	重要
import socket from "./socket.js"; //引入socket.js 重要
/* global uni */
var socketTask
var proxy
var stream

function buildProxy() {
    var proxy = new Transform()
    proxy._write = function (chunk, encoding, next) {
        socketTask.send({
            data: chunk.buffer,
            success: function () {
                next()
            },
            fail: function (errMsg) {
                next(new Error(errMsg))
            }
        })
    }
    proxy._flush = function socketEnd(done) {
        socketTask.close({
            success: function () {
                done()
            }
        })
    }

    return proxy
}

function setDefaultOpts(opts) {
    if (!opts.hostname) {
        opts.hostname = 'localhost'
    }
    if (!opts.path) {
        opts.path = '/'
    }

    if (!opts.wsOptions) {
        opts.wsOptions = {}
    }
}

function buildUrl(opts, client) {
    var protocol = opts.protocol === 'unis' ? 'wss' : 'ws'
    var url = protocol + '://' + opts.hostname + opts.path
    if (opts.port && opts.port !== 80 && opts.port !== 443) {
        url = protocol + '://' + opts.hostname + ':' + opts.port + opts.path
    }
    if (typeof (opts.transformWsUrl) === 'function') {
        url = opts.transformWsUrl(url, opts, client)
    }
    return url
}

function bindEventHandler() {
    socketTask.onOpen(function () {
        stream.setReadable(proxy)
        stream.setWritable(proxy)
        stream.emit('connect')
    })

    socketTask.onMessage(function (res) {
        var data = res.data

        if (data instanceof ArrayBuffer) data = Buffer.from(data)
        else data = Buffer.from(data, 'utf8')
        proxy.push(data)
    })

    socketTask.onClose(function () {
        stream.end()
        stream.destroy()
    })

    socketTask.onError(function (res) {
        stream.destroy(new Error(res.errMsg))
    })
}

function buildStream(client, opts) {
    opts.hostname = opts.hostname || opts.host

    if (!opts.hostname) {
        throw new Error('Could not determine host. Specify host manually.')
    }

    var websocketSubProtocol =
        (opts.protocolId === 'MQIsdp') && (opts.protocolVersion === 3)
            ? 'mqttv3.1'
            : 'mqtt'

    setDefaultOpts(opts)

    var url = buildUrl(opts, client)
    new socket({
        url: url,
        SocketState: { //必填存储数据的地方
            store,
            success: ['SocketState', 'setSocketState'],
            err: ['SocketStateErr', 'setSocketStateErr']
        },
        protocols: websocketSubProtocol
    }).then(res =>{
        socketTask = res;
    });

    proxy = buildProxy()
    stream = duplexify.obj()
    stream._destroy = function (err, cb) {
        socketTask.close({
            success: function () {
                cb && cb(err)
            }
        })
    }

    var destroyRef = stream.destroy
    stream.destroy = function () {
        stream.destroy = destroyRef

        var self = this
        process.nextTick(function () {
            socketTask.close({
                fail: function () {
                    self._destroy(new Error())
                }
            })
        })
    }.bind(stream)

    bindEventHandler()

    return stream
}

module.exports = buildStream
