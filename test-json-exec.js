'use strict';

var util = require('util');

var JsonExec = require('./');
var json_comp = require('./').json_comp;
var json_exec = require('./').json_exec;

if (typeof Symbol === 'undefined') var Symbol = function(name) { return String(name) };

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
        var je = json_comp({ b: 1, c: 2 }, { default: 'missing' });
        var str = je.exec({ a: 'one', b: 'two', c: 'three' });
        t.equal(str, '{"b":"two","c":"three"}');
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

    'converters functions should stringify their type': function(t) {
        var tests = [
            { type: 'null', value: null, expect: 'null' },
            { type: 'undefined', value: undefined, expect: '(default)' },
            { type: 'number', value: 1, expect: '1' },
            { type: 'number', value: 2.5, expect: '2.5' },
            { type: 'number', value: NaN, expect: 'null' },
            { type: 'number', value: Infinity, expect: 'null' },
            { type: 'number', value: -Infinity, expect: 'null' },
            { type: 'boolean', value: true, expect: 'true' },
            { type: 'boolean', value: false, expect: 'false' },
            { type: 'string', value: 'foobar', expect: '"foobar"' },
            { type: 'string', value: 'foobar\xff\n', expect: '"foobar\xff\\n"' },
            { type: 'symbol', value: Symbol('foo'), expect: '(default)' },
            { type: 'bigint', value: 123, expect: '(default)' },
            { type: 'object', value: {}, expect: '{}' },
            { type: 'object', value: { a: 1 }, expect: '{"a":1}' },
            { type: 'object', value: { a: 1, b: { c: 3 } }, expect: '{"a":1,"b":{"c":3}}' },

            { type: 'object', value: null, expect: 'null' },
        ];

        for (var i = 0; i < tests.length; i++) {
            var converters = JsonExec.buildJsonConverters('(default)');
            t.equal(converters[tests[i].type](tests[i].value, {}), tests[i].expect, require('util').inspect(tests[i]));
        }

        t.done();
    },

    'should stringify strings': function(t) {
        var je = json_comp({ a: 'string' });
        for (var ch = 0; ch < 0x1000; ch++) {
            var str = String.fromCharCode(ch);
            var str2 = String.fromCharCode(ch) + String.fromCharCode(ch);;
            t.equal(json_exec(je, { a: str }), JSON.stringify({ a: str }));
            t.equal(json_exec(je, { a: str2 }), JSON.stringify({ a: str2 }));
        }
        t.done();
    },

    'should stringify items': function(t) {
        var date = new Date();
        date.v = 123;
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
            { a: new Date() },
            { a: /foo/im },

            // FIXME: how should these be handled?
            // { v: date },
            // date,
        ];

        for (var i = 0; i < tests.length; i++) {
            var testObject = tests[i];
            var je = json_comp(testObject);
            //console.log("AR: test obj", je);
            t.deepEqual(json_exec(je, testObject), JSON.stringify(testObject), util.inspect(testObject));
        }

        t.done();
    },

    'should test speed 200k': function(t) {
        var testObj = { a: 'ABC', b: 1, c: 'DEFGHI\xff', d: 1234.567, e: null };
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

    'edge cases': {
        'should handle an empty template': function(t) {
            var je = json_comp({});
            t.equal(json_exec(je, { a: 1 }), "{}");
            t.done();
        },

        'should encode unexpected objects': function(t) {
            var je = json_comp({ a: 1 });
            var str = je.exec({ a: { b: 2 } });
            var obj = JSON.parse(str);
            t.deepEqual(obj, { a: { b: 2 } });
            t.done();
        },

        'should encode non-objects': function(t) {
            var tests = [
                [null, 'null'],
                [undefined, 'null'],
                [1, '{"a":"??"}'],
                ["seven", '{"a":"??"}'],
            ];

            for (var i = 0; i < tests.length; i++) {
                var je = json_comp({ a: 1 }, { default: '??' });
                t.equal(json_exec(je, tests[i][0]), tests[i][1]);
            }
            t.done();
        },

        'should encode unexpectely null objects as null': function(t) {
            var je = json_comp({ a: { b: 1 } });
            var str = je.exec({ a: null });
            t.equal(str, '{"a":null}');
            t.done();
        },

        'should json encode strings on node-v10': function(t) {
            var ver = process.version;
            Object.defineProperty(process, 'version', { value: 'v10.15.0' });
            t.unrequire('./');
            var json_comp = require('./').json_comp;
            var je = json_comp({ a: "string" });
            // for short strings
            t.equal(je.exec({ a: "Hi!" }), '{"a":"Hi!"}');
            // for converted ascii strings
            t.equal(je.exec({ a: "Hello,\n world." }), '{"a":"Hello,\\n world."}');
            // for very long strings
            t.equal(je.exec({ a: new Array(1000).join('x') }), '{"a":"' + new Array(1000).join('x') + '"}');
            t.unrequire('./');
            Object.defineProperty(process, 'version', { value: ver });
            t.done();
        },
    },
}
