'use strict';

var qtimeit = require('qtimeit');
var JsonExec = require('./');
var json_comp = JsonExec.json_comp;
var json_exec = JsonExec.json_exec;

try { var fastjsonstringify = require('fast-json-stringify'); } catch (e) {}


var logline = {
      "name" : "MyApp",
      "hostname" : "server",
      "pid" : 22467,
      "audit" : true,
      "level" : "info",
      "remoteAddress" : "127.0.0.1",
      "remotePort" : 58539,
      "req_id" : "-",
      "req" : {
        "method" : "GET",
        "url" : "/healthcheck",
        "headers" : {
          "host" : "localhost:8888"
        },
        "httpVersion" : "1.1",
        "trailers" : {
        },
        "version" : "1.0.0",
        "timers" : {
        }
      },
      "res" : {
        "statusCode" : 200,
        "trailer" : false
      },
      "rusage" : {
        "utime" : 0,
        "stime" : 0,
        "wtime" : 0.00018252001609653234,
        "maxrss" : 0,
        "inblock" : 0,
        "oublock" : 0
      },
      "query" : 'null',         // was null, cannot auto-build strfy template
      "latency" : 'null',       // was null
      "_audit" : true,
      "msg" : "handled: 200",
      "time" : "2015-01-15T05:04:55.114Z",
      "v" : 0,
      "requestId" : "-"
};

//var data = { a: 'test' };
//var data = { a: { b: { c: { d: { e: 1 } } } } };
//var data = { a: 'ABC', b: 1, c: 'DEFGHI\xff', d: 1234.567, e: null };
//var data = { a: 'ABC', b: 1, c: 'DEFGHI\xff', d: 1234.567, e: 'null' };
var data = logline;

var x, jx, je = JsonExec.comp(data);
var bench = {
    'JSON.stringify': function() {
        x = JSON.stringify(data);
    },

    'json_comp': function() {
        je = json_comp(data);
    },

    'json_exec': function() {
        jx = json_exec(je, data);
    },
};
if (fastjsonstringify) {
    var templatize = function(obj) {
        var properties = {};
        for (var k in obj) {
            // supported types are 'string', 'integer', 'number', 'array', 'object', 'boolean', 'null'
            // note: default: 'null' and '-' encode to an empty string (not the strings "null" or "-")
            // note: so is there no way to emit a {"prop":null} null-valued property?
            if (obj[k] === null) properties[k] = { type: 'string', default: '-' };
            // note: type: 'null' hardcodes a null value in the output
            // if (obj[k] === null) properties[k] = { type: 'null' };
            // note: anyOf destroys performance to less than half
            // if (obj[k] === null) properties[k] = { 'anyOf': [{ type: 'null' }, { type: 'string' }, { type: 'number' }, { type: 'boolean' }] };
            else if (Array.isArray(obj[k])) properties[k] = { type: 'array' };
            else if (obj[k] && typeof obj[k] == 'object') properties[k] = { type: 'object', properties: templatize(obj[k]) }
            else properties[k] = { type: typeof obj[k] };
        }
        return properties;
    }

    var template, strfy;
    bench['fast-json-templatize'] = function() {
        template = { type: 'object', properties: templatize(data) };
    }
    bench['fast-json-comp'] = function() {
        strfy = fastjsonstringify(template);
    }
    bench['fast-json-stringify'] = function() {
        x = strfy(data);
    }
}

qtimeit.bench.timeGoal = 0.41;
qtimeit.bench.visualize = true;
for (var i = 0; i < 1; i++) {
    qtimeit.bench(bench);
    qtimeit.bench.showPlatformInfo = false;
}
console.log(jx);
