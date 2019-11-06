'use strict';

var util = require('util');

var json_comp = require('./').json_comp;
var json_exec = require('./').json_exec;

module.exports = {
    'should compile template': function(t) {
        t.equal(typeof json_comp({}), 'object');
        t.done();
    },

    'should exec template': function(t) {
        t.skip();
    },

    'should omit unknown properties': function(t) {
        t.skip();
    },

    'should encode missing properties as null': function(t) {
        t.skip();
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
        var testObj = { a: { a: 'ABC', b: 1, c: 'DEFGHI\xff', d: 1234.567, e: null } };
        var nloops = 200000;

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
