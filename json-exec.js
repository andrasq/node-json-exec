/**
 * json-comp -- precompile json
 *
 * Copyright (C) 2019 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2019-03-27 - AR.
 * 2019-11-05 - faster stringify()
 *
 * Related work:
 *      https://github.com/fastify/fast-json-stringify
 */

'use strict';

module.exports = JsonExec;
module.exports.json_comp = json_comp;
module.exports.json_exec = json_exec;


/*
 * compile the object into a preformatted json template
 *
 * Constructs a template array of [string, key, string, ..., key, string] where
 * the strings are constants and the keys are the names of properties to encode.
 * The template will always contain one more string constant than keys.
 *
 * Format is a sample object to use for the layout and any constant values.
 *
 * TODO: build a function that extracts the obj properties,
 *       ie encode the layout in the code, not an array.
 */
function json_comp( format, options ) {
    var options = options || {};
    var constants = options.const || {};

    var template = [];
    var keys = Object.keys(format);

    // find a separator that differs from every key and every constant
    var separator = '|';
    for (var i = 0; i < keys.length; i++) {
        separator += keys[i] + '|';
        if (constants[keys[i]] !== undefined) separator += constants[keys[i]] + '|';
    }
    separator += '|';

    // create a sample object to stringify
    var sample = {};
    for (var i = 0; i < keys.length; i++) {
        sample[keys[i]] = constants[keys[i]] !== undefined ? constants[keys[i]] : separator;
        if (format[keys[i]] && format[keys[i]].constructor === Object && constants[keys[i]] === undefined) {
            // TODO: pin down const property handling, ie whether to allow nested or top-level-only const properties
            var runner = json_comp(format[keys[i]], { const: constants[keys[i]] });
            template.push(runner);
        }
    }

    // compile all nested objects too
    var runners = {};
    for (var i = 0; i < keys.length; i++) {
        if (format[keys[i]] != null && format[keys[i]].constructor === Object && constants[keys[i]] === undefined) {
            runners[keys[i]] = json_comp(format[keys[i]]);
        }
    }

    // construct the template by splitting the sample json into the constant strings
    // The split-on pattern has to match its stringified version.
    var sampleJson = JSON.stringify(sample);
    var strings = sampleJson.split(JSON.stringify(separator));

    // interleave preformatted keys (strings[]) with key names (keys[])
    // if the field name is an array, it is a sub-object that must be recursively exec-d
    var template = [];
    template.push(strings.shift());
    for (var i = 0; i < keys.length; i++) {
        if (constants[keys[i]] === undefined) {
            if (runners[keys[i]]) template.push([keys[i], runners[keys[i]]]);
            // TODO: store in an object, not array
            else template.push(keys[i]);
            template.push(strings.shift());
        }
    }

    return new JsonExec({ template: template, default: options.default, const: options.const });
}

function json_exec( encoder, obj ) {
    var template = encoder.template;
    var defaultString = encoder.defaultString;
    var len = template.length;

    var json = '';
    for (var i = 0; i + 2 < len; i += 2) {
        // preformatted quoted property name with : separator
        json += template[i];

        // verbatim property name
        var nestedCoder, name = template[i + 1];
        if (Array.isArray(name)) { nestedCoder = name[1]; name = name[0]; }
        var value = obj[name];

        // stringify the property value
        if (value === null) json += 'null';
        else if (value === undefined) json += defaultString;
        else if (typeof value === 'number') json += (value > -Infinity && value < Infinity) ? value : 'null';
        else if (typeof value === 'string') json += jsonEncodeString(value);
        else if (typeof value === 'object' && !Array.isArray(value)) json += json_exec(nestedCoder, value); // recursive object
        else if (typeof value === 'boolean') json += value ? 'true' : 'false';
        else json += JSON.stringify(value);
    }
    json += template[i];

    return json;
}


function JsonExec( options ) {
    this.template = options.template;
    this.defaultString = JSON.stringify(options.default !== undefined ? options.default : null);
    this.const = options.const;
}
JsonExec.comp = function comp( template, options ) {
    return json_comp(template, options);
}
JsonExec.prototype.comp = function comp( template, options ) {
    var je = json_comp(template, options);
    for (var k in je) this[k] = je[k];
    return this;
}
JsonExec.prototype.exec = function exec( obj ) {
    return json_exec(this, obj);
}

// stringify the item like json, except undefined is encoded as null.
// numbers are returned as-is, since faster to concat numbers to strings than to coerce first
/**
function stringify( item ) {
    if (item == null) return 'null';
    else switch (typeof item) {
    case 'number': return (item > -Infinity && item < Infinity) ? item : 'null';
    case 'string': return jsonEncodeString(item);
    case 'boolean': return item ? 'true' : 'false';
    default: return JSON.stringify(item);
    }
}
**/

// from qbson:
function jsonEncodeString( str ) {
    return (/[\x00-\x1F\\\"\u007F-\uFFFF]/.test(str)) ? JSON.stringify(str) : '"' + str + '"';
    // return (str.length > 20 || _needEscaping(str)) ? JSON.stringify(str) : '"' + str + '"';
}
/**
function _needEscaping( str ) {
    var len = str.length;
    for (var i = 0; i < len; i++) {
        var ch = str.charCodeAt(i);
        if (ch === 0x22 || ch === 0x5c || ch < 0x20 || ch >= 0x7f) return true;
    }
    return false;
}
**/

toStruct(JsonExec.prototype);
function toStruct(hash) { return toStruct.prototype = hash }


/** quicktest:

try { var fastjsonstringify = require('fast-json-stringify'); } catch (e) {}

var timeit = require('qtimeit');

var x;
console.log(x = json_comp({a:1, b:2, c:null, d:1}, { const: { c: 777 } }));
console.log(json_exec(x, {a:123, c: 2, b:"foo\n"}));

var obj = { a: { a: 'ABC', b: 1, c: 'DEFGHI\xff', d: 1234.567, e: null } };
var obj = { a: 'ABC', b: 1, c: 'DEFGHI\xff', d: 1234.567, e: null };
var obj = { a: 'ABC', b: 1, c: 'DEFGHI\xff', d: 1234.567, e: 'null' };
//var obj = { a: { b: { c: { d: { e: 1 } } } } };
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
}
var obj = logline;
//var obj = { a: 'test' };

var nloops = 200000;
var je = json_comp(obj);
timeit(nloops, function() { x = JSON.stringify(obj) });
// 258k/s
// ABC: 1.0m/s
timeit(nloops, function() { x = je.exec(obj) });
timeit(nloops, function() { x = json_exec(je, obj) });
console.log(x);
// 441k/s
// ABC: 1.7m/s
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
    var schema = { type: 'object', properties: templatize(obj) };
    var strfy = fastjsonstringify(schema);
    timeit(nloops, function() { x = strfy(obj) });
}
console.log(x);

/**/
