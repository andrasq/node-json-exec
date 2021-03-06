/**
 * json-comp -- precompile json
 *
 * Copyright (C) 2019-2021 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2019-03-27 - AR.
 * 2019-11-05 - split out of json-simple
 */

'use strict';

module.exports = JsonExec;
module.exports.json_comp = json_comp;
module.exports.json_exec = json_exec;
module.exports.stringify = stringify;


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
        if (keys[i][0] === '|') separator += keys[i] + '|';
        if (constants[keys[i]] !== undefined && constants[keys[i]][0] === '|') separator += constants[keys[i]] + '|';
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
            runners[keys[i]] = json_comp(format[keys[i]], options);
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
            var key = keys[i];
            var value = format[key];
            var fmt = {
                name: key,
                type: jsonTypeof(value),
                converter: JsonExec.buildJsonConverters(options.default)[jsonTypeof(value)],
                encoder: null,
            };
            if (runners[key]) fmt.encoder = runners[key];
            template.push(fmt);
            template.push(strings.shift());
        }
    }

    return new JsonExec({ template: template, default: options.default, const: options.const });
}

/*
 * stringify the object properties built into the template
 *
 * The template contains the stringified property names to interleave
 * with stringified property descriptors `{name,encoder}` used to look up
 * the property value and stringify object values, respectively.
 */
function json_exec( encoder, obj ) {
    var template = encoder.template;

    if (!obj && obj == null) return 'null';

    var limit = template.length - 2;
    var json = '';
    for (var i = 0; i < limit; i += 2) {
        var fmt = template[i + 1];
        var value = obj[fmt.name];

        // stringify the property name
        json += template[i];

        // stringify the property value
        // json += value === null ? 'null' : encoder.converters[typeof value](value, fmt); // 330k/s
        if (value === null) json += 'null';
        else if (typeof value === 'number') json += (value > -Infinity && value < Infinity) ? value : 'null';
        else if (typeof value === 'string') json += jsonEncodeString(value);
        else if (typeof value === 'boolean') json += value ? 'true' : 'false';
        else json += stringify(value, fmt, encoder.defaultString);
        // 520k/s, faster to re-typeof each time than to store typename
    }
    json += template[i];

    return json;
}

function jsonTypeof( value ) {
    // one of: null undefined number string boolean object symbol bigint
    return value === null ? 'null' : typeof value;
}

/*
 * return a function that will stringify the given json type
 * TODO: if stringifying a Date with template {a:1}, scrape properties? or toJSON?
 */
function buildJsonConverter( type, defaultString ) {
    switch (type) {
    case 'null': return function() { return 'null' };
    case 'number': return function(value) { return (value > -Infinity && value < Infinity) ? value : 'null' };
    case 'boolean': return function(value) { return value ? 'true' : 'false' };
    case 'string': return function(value) { return jsonEncodeString(value) };

    case 'symbol': // symbol properties are omitted
    case 'bigint': // bigints normally throw (TODO?)
    case 'undefined': return function() { return defaultString };

    case 'object':
    default:
        return function(value, fmt) {
            if (!Array.isArray(value) && fmt.encoder && value) return fmt.encoder.exec(value);
            return JSON.stringify(value);
        };
    }
}

// general-purpose stringifier, a fall-back in case the stringifier function guessed wrong
// a typeofToString table method lookup is slower, a switch on the type is slower
// an external stringify() function is slower, a switch (true) is slower,
// a pure type table lookup conversion is slower
function stringify( value, fmt, defaultString ) {
    var json;

    if (value == null) json = (value === null) ? 'null' : defaultString;
    // if (value === null) json = 'null';
    // symbols, bigints and undefineds are omitted
    else if (typeof value === 'object' && isHash(value)) {
        // expected object {}
        if (fmt && fmt.encoder) {
            json = json_exec(fmt.encoder, value);
        }
        // unexpected hash {}
        else {
            json = '';
            var keys = Object.keys(value);
            for (var i=0; i<keys.length; i++) {
                if (json) json += ',';
                json += jsonEncodeString(keys[i]);
                json += ':' + stringify(value[keys[i]], null, defaultString);
            }
            json = '{' + json + '}';
        }
    }
    else if (Array.isArray(value)) {
        var json = '';
        for (var i=0; i<value.length; i++) json += (json ? ',' : '') + stringify(value[i], null, defaultString);
        json = '[' + json + ']';
    }
    // JSON returns undefined for Symbol and undefined, and throws on BigInt
    else if (typeof value === 'symbol' || typeof value === 'bigint' || typeof value === 'undefined') json = defaultString;
    else if (typeof value === 'number') json = (value > -Infinity && value < Infinity) ? value : 'null';
    else if (typeof value === 'string') json = jsonEncodeString(value);
    else if (typeof value === 'boolean') json = value ? 'true' : 'false';
    else {
        // unexpected object eg Date
        json = JSON.stringify(value);
    }

    return json;
}
function isHash(o) { return o && o.constructor === Object }

function JsonExec( options ) {
    this.template = options.template;
    this.defaultString = JSON.stringify(options.default !== undefined ? options.default : null);
    this.const = options.const;

    this.converters = JsonExec.buildJsonConverters(this.defaultString);
    var self = this;
}
JsonExec.jsonConverters = {};
JsonExec.buildJsonConverters = function buildJsonConverters( defaultString ) {
    if (!JsonExec.jsonConverters[defaultString]) {
        JsonExec.jsonConverters[defaultString] = {};
        ['null', 'undefined', 'number', 'string', 'boolean', 'object', 'symbol', 'bigint']
            .forEach(function(type) {
                JsonExec.jsonConverters[defaultString][type] = buildJsonConverter(type, defaultString);
            });
        toStruct(JsonExec.jsonConverters[defaultString]);
    }
    return JsonExec.jsonConverters[defaultString];
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

// from qbson:
function jsonEncodeString( str ) {
    return (_needEscaping(str)) ? JSON.stringify(str) : '"' + str + '"';
}
var nodeMajor = parseInt(process.versions.node);
function _needEscaping( str ) {
    if (nodeMajor <= 9) {
        // regex is faster with node <= v9, slower with >= v10
        return str.length > 400 || /[\x00-\x1F\\\"\u007F-\uFFFF]/.test(str);
    }
    else {
        var len = str.length;
        if (len > 150) return true;
        for (var i = 0; i < len; i++) {
            var ch = str.charCodeAt(i);
            if (ch === 0x22 || ch === 0x5c || ch < 0x20 || ch >= 0x7f) return true;
        }
        return false;
    }
}

toStruct(JsonExec.prototype);
function toStruct(hash) { return toStruct.prototype = hash }
