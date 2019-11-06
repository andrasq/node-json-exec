json-exec
=========

Fast templated json stringify.  Convenient API, very simple to use.  Great for logging, RPC,
or other use cases where the object schema does not vary.

    const json_comp = require('json-exec').json_comp;
    const json_exec = require('json-exec').json_exec;

    const coder = json_comp({ name: 'String', age: 123 });

    json_exec({ name: 'Mickey Mouse', age: 91, color: 'black' });
    // => '{"name":"Mickey Mouse","age":91}'
    json_exec({ name: 'Minnie Mouse' });
    // => '{"name":"Minnie Mouse","age":null}'


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
not skipped, they're stringified as `null`.


Related Work
----------------

- [fast-json-stringify](http://github.com/fastify/fast-json-stringify)
- [json-simple](http://github.com/andrasq/node-json-simple)
