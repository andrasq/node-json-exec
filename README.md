json-exec
=========
[![Build Status](https://travis-ci.org/andrasq/node-json-exec.svg?branch=master)](https://travis-ci.org/andrasq/node-json-exec)
[![Coverage Status](https://coveralls.io/repos/github/andrasq/node-json-exec/badge.svg?branch=master)](https://coveralls.io/github/andrasq/node-json-exec?branch=master)

Fast templated json stringify.  Convenient API, very simple to use.  Like JSON.stringify,
but optimized for objects that are likely to share a common schema.

Use for logging, RPC, or other use cases where the object schema does not vary.

    const json_comp = require('json-exec').json_comp;
    const json_exec = require('json-exec').json_exec;

    const coder = json_comp({ name: 'String', age: 123 });

    json_exec(coder, { name: 'Mickey Mouse', age: 91, color: 'black' });
    // => '{"name":"Mickey Mouse","age":91}'

    json_exec(coder, { name: 'Minnie Mouse' });
    // => '{"name":"Minnie Mouse","age":null}'

For example, to speed up the logging of fixed-pattern objects:

    // auto-initialize the logline json encoder
    var loglineCoder = loglineCoder || json_comp(logObject);

    // log the json string
    var logline = json_exec(loglineCoder, logObject);
    logger.log(logline);


API
----------------

### encoder = json_comp( templateObject )

Build a json encoder to stringify the properties of the template.  The template is a
duck-typing description of the properties and types to encode from data objects; in
particular, the template may be an instance of a data object.

The data object properties should be of the same type as the corresponding template
properties.  A missing data property will be encoded as `null` (instead of being skipped as
by JSON.stringify).


### string = json_exec( encoder, dataObject )

Use the encoder to stringify the data object according to the template.  Missing values are
not skipped, they're stringified as `null`.  Properties that were not present in the template
are omitted.


Changelog
----------------

- 0.1.3 - bug fixes, tuning
- 0.1.0 - initial version with `json_comp` and `json_exec`


Todo
----------------

- allow for constant properties that will not be re-stringified each time
- build a template-specific stringifier function instead of walking the template


Related Work
----------------

- [fast-json-stringify](http://github.com/fastify/fast-json-stringify)
- [json-simple](http://github.com/andrasq/node-json-simple)
