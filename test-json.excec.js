'use strict';

var util = require('util');

var JsonExec = require('./');
var json_comp = require('./').json_comp;
var json_exec = require('./').json_exec;

module.exports = {
    'should compile template with function': function(t) {
        t.ok(json_comp({}) instanceof JsonExec);
        t.done();
    },

    'should compile with class method': function(t) {
        t.ok(JsonExec.comp({ a: 1 }) instanceof JsonExec);
        t.done();
    },

    'should compile and exec with instance methods': function(t) {
        var je = json_comp({ a: 1 });
        t.ok(je instanceof JsonExec);
        je = je.comp({ b: 1 });
        t.equal(je.exec({ a: 1, b: 2 }), '{"b":2}');
        t.done();
    },

    'should omit unknown properties': function(t) {
        var je = json_comp({ b: 1, c: 2, d: 3 }, { default: 'missing' });
        var str = je.exec({ a: 'one', b: 'two', c: 'three' });
        t.equal(str, '{"b":"two","c":"three","d":"missing"}');
        t.done();
    },

    'should encode missing properties as null': function(t) {
        var je = json_comp({ a: 1, b: 2 });
        var str = je.exec({ a: 'one', c: 3 });
        t.equal(str, '{"a":"one","b":null}');
        t.done();
    },

    'should encode missing properties as default': function(t) {
        var je = json_comp({ a: 1, b: 2 }, { default: 999 });
        var str = je.exec({ a: 'one', c: 3 });
        t.equal(str, '{"a":"one","b":999}');
        t.done();
    },

    'should encode missing undefined properties as default': function(t) {
        var coder = json_comp({ a: 1, b: 2 }, { default: '-' });
        var obj = JSON.parse(json_exec(coder, { a: 234 }));
        t.deepEqual(obj, { a: 234, b: '-' });
        t.done();
    },

    'should not change constant properties': function(t) {
        var je = json_comp({ a: 1, b: 2 }, { const: { a: 'one', c: 123 } });
        var decoded = JSON.parse(json_exec(je, { a: 111, b: 222, c: 333 }));
        t.deepEqual(decoded, { a: 'one', b: 222 });
        t.done();
    },

    'should stringify items': function(t) {
        var tests = [
            //null,
            //1,
            //2.5,
            {},
            { n: 1234 },
            { n1: NaN, n2: Infinity, n3: -Infinity },
            { s: 'string' },
            { utf8: 'a\xff\xf8b' },
            { b1: true, b2: false },
            { c: null, a: 1 },
            { o1: { a: 1 }, o2: { b: {} } },
            { a1: [1,2], a2: [3] },
            { a: [{ b: 1 }, 2] },
        ];

        for (var i = 0; i < tests.length; i++) {
            var testObject = tests[i];
            var je = json_comp(testObject);
            //console.log("AR: test obj", je);
            t.deepEqual(json_exec(je, testObject), JSON.stringify(testObject), util.inspect(testObject));
        }

        t.done();
    },

    'should stringify fast 200k': function(t) {
        var testObj = { a: 'ABC', b: 1, c: 'DEFGHI\xff', d: 1234.567, e: null };
        var nloops = 100000;

        var t1 = Date.now();
        for (var i = 0; i < nloops; i++) var x = JSON.stringify(testObj);
        var t2 = Date.now();
        console.log("JSON.stringify %d in %d ms", nloops, t2 - t1);

        var t1 = Date.now();
        for (var i = 0; i < nloops/10; i++) var je = json_comp(testObj);
        var t2 = Date.now();
        console.log("json_comp %d in %d ms", nloops/10, t2 - t1);

        var t1 = Date.now();
        for (var i = 0; i < nloops; i++) var x = json_exec(je, testObj);
        var t2 = Date.now();
        console.log("json_exec %d in %d ms", nloops, t2 - t1);

        t.done();
    },
}
