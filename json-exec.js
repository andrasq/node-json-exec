/**
 * json-comp -- precompile json
 *
 * Copyright (C) 2019 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2019-03-27 - AR.
 * 2019-11-05 - split out of json-simple
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
            // missing properties are faster to test than to read (as undefined)
            if (runners[key]) template.push({ name: key, encoder: runners[key] /*, stringifier: (buildStringifier(template[key], runners[key], options.default), stringify) */ });
            else template.push({ name: key, encoder: null /*, stringifier: (buildStringifier(template[key], null, options.default), stringify) */ });
            template.push(strings.shift());
        }
    }

    return new JsonExec({ template: template, default: options.default, const: options.const });
}

/*
 * stringify the object properties built into the template
 *
 * The template contains the stringified property names to stringify
 * interleaved with property descriptors `{name,encoder}` used to
 * look up the property value and stringify object values, respectively.
 */
function json_exec( encoder, obj ) {
    var template = encoder.template;
    var defaultString = encoder.defaultString;
    var len = template.length;

    if (obj === null) return 'null';

    var json = '';
    for (var i = 0; i < len - 2; i += 2) {
        var fmt = template[i + 1];
        var value = obj[fmt.name];

        // stringify the property value
        // a typeofToString table method lookup is slower, a switch on the type is slower
        // an external stringify() function is slower (and is only 1% of cpu)
        json += template[i];
             if (typeof value === 'number') json += (value > -Infinity && value < Infinity) ? value : 'null';
        else if (typeof value === 'string') json += jsonEncodeString(value);
        else if (typeof value === 'object' && fmt.encoder && !Array.isArray(value)) json += json_exec(fmt.encoder, value);
        else if (typeof value === 'boolean') json += value ? 'true' : 'false';
        else if (value === null) json += 'null';
        else if (value === undefined) json += defaultString;
        else json += JSON.stringify(value);
    }
    json += template[i];

    return json;
}

/**
function buildStringifier( value, fmt, defaultString ) {
    var _stringify = null;

    if (value === null) return function(value, fmt) {
        return (value === null) ? 'null' : stringify(value, fmt, defaultString) }
    else if (value === undefined) return function(value, fmt) {
        return (value === undefined) ? defaultString : stringify(value, fmt, defaultString) }
    else if (typeof value === 'number') return function(value, fmt) {
        return (value > -Infinity && value < Infinity) ? value : stringify(value, fmt, defaultString) }
    else if (typeof value === 'string') return function(value, fmt) {
        return (typeof value === 'string') ? jsonEncodeString(value) : stringify(value, fmt, defaultString) }
    else if (typeof value === 'boolean') return function(value, fmt) {
        return (typeof value === 'boolean') ? (value ? 'true' : 'false') : stringify(value, fmt, defaultString) }
    else if (typeof value === 'object' && fmt.encoder && !Array.isArray(value)) return function(value, fmt) {
        return (typeof value === 'object' && fmt.encoder && !Array.isArray(value)) ? fmt.encoder.exec(value) : stringify(value, fmt, defaultString) }
    else return function(value, fmt) {
        return stringify(value, fmt, defaultString) }

    return _stringify;
}

// stringify the property value
// a typeofToString table method lookup is slower, a switch on the type is slower
// an external stringify() function is slower
function stringify( value, fmt, defaultString ) {
    var json;

    if (value === null) json = 'null';
    else if (value === undefined) json = defaultString;
    else if (typeof value === 'number') json = (value > -Infinity && value < Infinity) ? value : 'null';
    else if (typeof value === 'string') json = jsonEncodeString(value);
    else if (typeof value === 'boolean') json = value ? 'true' : 'false';
    else if (typeof value === 'object' && fmt.encoder && !Array.isArray(value)) json = json_exec(fmt.encoder, value);
    else json = JSON.stringify(value);

    return json;
}
**/

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

// from qbson:
function jsonEncodeString( str ) {
    return (_needEscaping(str)) ? JSON.stringify(str) : '"' + str + '"';
}
var nodeMajor = parseInt(process.version.slice(1));
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
