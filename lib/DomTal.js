// DomTal 2.0 - A TAL template parser for javascript.
// 
// copyright (c) 2005-2012 Iván -DrSlump- Montes <http://pollinimini.net>
// 
// Distributed under the MIT license

(function(exports){ "use strict";

// -----------------------------------------------------------------------------
//
// Credits
// -------
//
//   - The script originated from work by Joachim Zobel <http://www.heute-morgen.de/test/About_DOMTAL.html> (used with permission)
//  
// Known issues
// ------------
//
//    - This script uses the own browser to parse the html, so you must be carefull 
//      with the validity of the code. A common mistake is to use the short syntax 
//      `<tag />` for elements which shouldn't according to the standard.
//      It's always a good idea to use the full syntax (except for `<br/>` and `<hr/>`) 
//      even when no content is defined.
//
//    - In Internet Explorer the tal attributes (processors) can't be removed from
//      the generated code although this shouldn't affect anything.
//
// Differences with standard TAL
// -----------------------------
//
//  - The default tales prefix/modifier is _js_, which resolves a basic javascript
//    statement instead of a simple path to a variable.
//  - No support for `tal:block` element.
//  - No support for `tal:on-error` processor.
//  - No support for `Metal`, however a similar behaviour can be mimicked with
//    document fragments and common tal processors.
//  - `omit-tag` works a bit differently. If the tales expression evaluates to true 
//    the tag is removed and its contents shown, otherwise the tag is also shown.
//    This is an intended change and can be easily removed by creating a custom
//    wrapper for this processor.
//
//
// TODO
// ----
//
//  - Check for performance bottlenecks and memory leaks
//
// -----------------------------------------------------------------------------
//
// Usage
// =====
//
//  First we need to have a template somewhere in the page. Be it as an html
//  string, a containing element or a document fragment.
//
//      <div id="myTemplate" style="display: none">
//          <table>
//          <tr>
//              <th>Username</th>
//              <th>E-Mail</th>
//          </tr>
//          <tr tal:repeat="user users"
//              tal:attributes="class js:${repeat.user.odd}?'odd':'even'">
//              <td tal:content="user.name"></td>
//              <td>${user.email}</td>
//          </tr>
//          </table>
//      </div>
//
//  we could also use an html string, either as a javascript string literal or
//  by using the script tag
//
//      <script type="template/domtal" id="myTemplate"><![CDATA[
//      <table>
//      <tr>
//          <th>Username</th>
//          <th>E-Mail</th>
//      </tr>
//      <tr tal:repeat="user users"
//          tal:attributes="class js:${repeat.user.odd}?'odd':'even'">
//          <td tal:content="user.name"></td>
//          <td>${user.email}</td>
//      </tr>
//      </table>
//      ]]></script>
//
//  next we need to create the template object and set the apropiate data. Note
//  that we can create the data set anyway we want, even loading it with JSON or
//  similar remoting methods.
//
//      var tpl = new DomTal();
//      tpl->set( 'users', [{
//        name: 'Joe Black',
//        email: 'jblack@yahoo.co.uk'
//      }, {
//        name: 'Mike Flowers',
//        email: 'mike.flowers@aol.es'
//      }]);
//
//  now we just need to assign our template to the parser, process it and get
//  the result
//
//      tpl.load( document.getElementById('myTemplate') );
//      var out = tpl.run();
//      // put the result on the page
//      document.getElmentById('outUsers').appendChild( out );
//
//  And that's it. There a few more options but overall it's a pretty easy to
//  use library.
//
//
// Customization
// =============
//
// Creating a new processor
// ------------------------
//
//  To extend the available processors we only need to create (or redefine) a
//  method in *DomTal.processors*. Be aware that the order in which the
//  processor methods are defined in the code specify their priority. The
//  standard ones are applied in this order:
//    `define`, `condition`, `repeat`, `content`, `replace`, `attributes`, `omit-tag`
//
//  The return value of a processor has meaning. If it returns _true_ then the
//  children elements of that node will be further processed, alternatively, if
//  it returns _false_ its children will be skipped.
//
//  We are going to create a new processor which will convert an array items to
//  a set of LI elements. It'll apply a class named 'selected' to the LI whose
//  key is equal to the second tales expression:
//  
//      <ul tal:li="path.to.array selectedKey" />
//
//  The processor implementation:
//
//      DomTal.prototype.processors.li = function (node, exp) {
//          var tales, key, arr;
//
//          exp = new ExpressionParser(exp);
//          tales = exp.tales();
//          key = exp.ident();
//
//          tales = this.tales(tales);
//          arr = this.makeIterable(tales);
//
//          node.innerHTML = '';
//          if (arr.count) {
//              for (var i=0; i<arr.count; i++) {
//                  var li = document.createElement('LI');
//                  if (arr.keys[i] == key)
//                      li.setAttribute('class', 'selected');
//                  li.appendChild( document.createTextNode( arr.values[i] ) );
//                  node.appendChild( li );
//              }
//          }
//
//          return false;
//      }
//
//  The following expression with a data set of ['one', 'two', 'three']
//
//      <ul id="list" tal:li="data 1">
//        <li>Test item</li>
//      </ul>
//
//  will generate the following html
//
//      <ul id="list">
//        <li>one</li>
//        <li class="selected">two</li>
//        <li>three</li>
//      </ul>
//
//
// Creating a new tales modifier
// -----------------------------
//
//  We can also add our own _Tales_ modifiers by extending the *DomTal.modifiers*
//  object with new methods. The methods just take an argument with the
//  expression to evaluate and should return the result of that argument.
//
//  In this example we are going to create a modifier which will evaluate to the string
//  'odd' or 'even' based on the value of an expression.
//
//      DomTal.prototype.modifiers.oddeven = function(exp) {
//          var value;
//          value = this.tales(exp);
//          return (value % 2) ? 'odd' : 'even';
//      }
//
//  then the following template
//
//      <span tal:content="oddeven: 3">foo</span>
//
//  will produce
//
//      <span class="odd">foo</span>
//
// ----------------------------------------------------------------


// DomTal.ExpressionParser
// =======================
//  Helper class to parse an expression. It's pretty rudimentary but we don't need 
//  anything fancy for the supported expression syntax.
//
function ExpressionParser(exp){
    this.exp = exp;
    this.pos = 0;
}

ExpressionParser.prototype.seek = function(ofs){
    this.pos = ofs;
};

ExpressionParser.prototype.skip = function(len){
    this.seek(this.pos + len);
};

ExpressionParser.prototype.consume = function(len){
    var ret = this.exp.substr(this.pos, len);
    this.skip(ret.length);
    return ret;
};

ExpressionParser.prototype.remaining = function(){
    return this.consume(this.exp.length - this.pos);
};

// An expression ident has the same syntax rules as a javascript one
ExpressionParser.prototype.ident = function(){
    return this.rex(/^\s*([A-Za-z$_][$\w]*)\s*/);
};

// Only decimal numbers, no support for hex format or exponents
ExpressionParser.prototype.number = function(){
    return this.rex(/^\s*(-?([0-9]+|[0-9]*?\.[0-9]+))\s*/);
};

// Matches a tales prefix (ie: string:hello world!)
ExpressionParser.prototype.prefix = function(){
    return this.rex(/^\s*([_$\w]+)\s*:/);
};

// A tales expression is basically any valid javascript statement with special
// threatment for spacing which behaves very similarly to how Javascript manages 
// end of lines for statements without a semi colon.
//
// The return value of this matcher is an array containing all the statements found. 
// Normally it will be a single item but if the expression contains alternates (ie: foo | bar)
// each alternate will be returned as an element of the array.
ExpressionParser.prototype.tales = function(){
    var eos = 0,  // 1: probable end, 2: confirmed end
        quoted = false,
        balanced = 0,
        pos = this.pos, 
        token,
        exp = [],
        result = [];

    while (true) {
        // Fetch the next token
        token = this.rex(/^([^(){}[\]'"\\|;:,\s]+|\s+|.)/);
        if (null !== token) {
            // If we are at the end of a statement and the next char is the start of a new one
            if (!quoted && 0 === balanced && eos > 1 && /^[\('"$\w]/.test(token)) {
                this.skip(-token.length);
                break;
            }

            switch (token.charAt(0)) {
            case '(': case '{': case '[':
                if (!quoted) balanced++;
                eos = 0;
                break;
            case ')': case '}': case ']':
                if (!quoted) balanced--;
                eos = 1;
                break;
            case '|': 
                eos = 0;
                if (!quoted && 0 === balanced) {
                    // Make sure it's not a double pipe (ie: var = foo || bar)
                    if (this.str('|')) {
                        token += '|';
                    } else {
                        result.push(exp.join('').replace(/\s+/, ''));
                        exp = [];
                        continue;
                    }
                }
                break;
            case '\\':
                token += this.consume(1);
                eos = 0;
                break;
            case "'": case '"':
                eos = 0;
                if (!quoted) {
                    quoted = token;
                } else if (quoted === token) {
                    quoted = false;
                    eos = 1;
                }
                break;
            case ';': case ',':
                // A comma or semicolon only terminates a statement if non quoted and outside parens
                if (!quoted && 0 === balanced) {
                    this.seek(this.pos-1);
                    token = null;
                }
                eos = 0;
                break;
            case ' ': case '\t':
                // skip initial white space
                if (!exp.length) continue; 
                // If we find a space after a probable end of statement we enforce it
                if (eos > 0) eos = 2;
                break;
            default:
                // An identifier signals a probable end of a statement
                eos = /\w/.test(token) && token !== 'new' ? 1 : 0;
            }
        }

        // Check if the parser has been signalled to terminate
        if (null === token) {
            // If we haven't completed a valid statement error out
            if (quoted || balanced !== 0) {
                this.seek(pos);
                return null;
            }

            break;
        }
    
        // Add the string to the expression
        exp.push(token);
    }

    // Add the last expression to the results
    if (exp.length) {
        result.push(exp.join('').replace(/\s+$/, ''));
    }

    // If nothing matched error out
    if (!result.length) {
        this.seek(pos);
        return null;
    }

    return result;
};

// Always returns the 1st capture if available
ExpressionParser.prototype.rex = function(rex){
    var m = rex.exec(this.exp.substr(this.pos));
    if (!m) return null;
    this.skip(m[0].length);
    return m.length > 1 ? m[1] : m[0];
};

ExpressionParser.prototype.str = function(str){
    var indent = 0, 
        idx = this.exp.indexOf(str, this.pos);

    if (-1 === idx) return null;

    // skip white space
    while (idx-- > this.pos) {
        if (this.exp.charAt(idx) !== ' ') return null;
        indent++;
    }

    this.skip(indent + str.length);
    return str;
};

ExpressionParser.prototype.toString = function(){
    return this.exp;
};


// WeightedList
// ------------
//  Helper class to keep the list of processors sorted based on a weight property
// 
function WeightedList(){
    this.clear();
}

WeightedList.prototype.add = function(itm, weight){
    var i, weights = this._weights, len = weights.length;
    for (i=0; i<len; i++) {
        if (weights[i] > weight) break;
    }

    if (i<len) {
        weights.splice(i, 0, weight);
        this._map.splice(i, 0, this._items.length);
    } else {
        weights.push(weight);
        this._map.push(this._items.length);
    }
    this._items.push(itm);
};

WeightedList.prototype.clear = function(){
    this._items = [];
    this._weights = [];
    this._map = [];
};

WeightedList.prototype.getByName = function(name){
    var proc = null;
    this.until(function(p){
        if (p.name === name) {
            proc = p;
            return false;
        }
        return true;
    });
    return proc;
};

WeightedList.prototype.hasByName = function (name) {
    return this.getByName(name) !== null;
};

WeightedList.prototype.each = function(fn, ctx){
    var i, items = this._items, map = this._map, len = map.length;
    ctx = ctx || {};
    for (i=0; i<len; i++) {
        fn.call(ctx, items[ map[i] ], map[i]);
    }
};

// Keeps looping while the return value is truly
WeightedList.prototype.until = function(fn, ctx){
    var i, cont = true, items = this._items, map = this._map, len = map.length;
    ctx = ctx || {};
    for (i=0; cont && i<len; i++) {
        cont = fn.call(ctx, items[ map[i] ], map[i]); 
    }
};


// ------------------------------------------------------------------


// DomTal
// ======


// Constructor
// -----------
//  The TAL template parser class
//
//  1. tpl    Optional, the template to load
//  2. data   Optional, the initial global variables to be used in the template
//  3. ns     Optional, the attributes namespace used in the template (by default is 'tal')
//
//      tpl = new DomTal('#mytpl', {test: 'foo'});
//
function DomTal(tpl, data, ns) {
    if (typeof data === 'string') {
        ns = data;
        data = null;
    }

    if (tpl) {
        if (!this.load(tpl)) {
            this.log('Unable to load template');
        }
    }

    this.ns = ns ? ns : 'tal';
    this.ns += ':';


    // Setup the data bucket
    this.stack = [];
    this.stack.push( data ? data : {} );

    // Default modifier for tales expressions
    this.defMod = this.modifiers.js;
}

// Constants
// ---------
//  We compare with === so we can use an object to detect them 
DomTal.NOTHING = {};
DomTal.DEFAULT = {};

DomTal.PROCTYPE = {
    DEFAULT : 'default',
    CONTENT : 'content',
    REPLACE : 'replace',
    PROXY   : 'proxy'
};

DomTal.PRIO = {
    MAX       : 0,
    VERYHIGH  : 100,
    HIGH      : 200,
    ABOVE     : 300,
    AVERAGE   : 400,
    BELOW     : 500,
    LOW       : 600,
    VERYLOW   : 700,
    MIN       : 1000
};


//
// Create some static caches to be shared among all instances
//
DomTal.cache = {
    js: {}, // cache for compiled tales expressions
    div: document.createElement('div')
};



// By default we allow access to the global Javascript context. This allows
// to use external helpers like underscore's function to work with arrays.
// Override this property with your own object to limit access to the environment
// from the templates.
DomTal.prototype.env = exports;


// getByPath
// ---------
//  Fetchs the contents of the variable defined by its path. The local variables
//  have priority. If the variable is not found it returns _undefined_. The path is 
//  splitted on forward slashes '/' and dots '.'.
//
DomTal.prototype.getByPath = function( path, ref ) {
    var i, j,
        parent, name, result;

    path = path.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    path = path.split(/[\/\.]/);

    // search in each data bucket starting from the top of the stack to its root
    i = this.stack.length;
    while (i--) {
        result = this.stack[i];
        // try to traverse the data structure according to the path
        for (j=0; result && j<path.length; j++) {
            parent = result;
            name = path[j];
            result = parent[name];
        }
        // if path found then return it, otherwise lets check the next data bucket
        if (typeof result !== 'undefined') {

            // TODO: This is an attempt to return functions with the right binding context applied
            //       we should make sure this is needed.
            if (typeof result === 'function' && !bind.is(result)) {
                result = result.bind(parent);
            }

            // If we asked for a reference supply one
            if (ref) {
                ref.object = parent;
                ref.property = name;
            }

            return result;
        }
    }

    this.log('Can not find a variable by this path: "' + path.join('/') + '"');
    return result;
};

// interpolate
// -----------
//  Interpolates the given text with the current set of variables.
//
DomTal.prototype.interpolate = function( txt ) {
    // copy the object scope var as local variable to be used in the regexp closure
    var me = this;

    // we capture the char just before so we can skip escaped marks. ie: $${..}
    //return txt.replace(/(^|[^\$])\$\{([^\}]+)\}/gmi, function(str, prefix, path) {
    // supports one level of nested balanced braces (TODO: is this worth it?)
    return txt.replace(/(^|[^\$])\$\{((?:[^{}]+|{[^{}]*})*)\}/gmi, function(str, prefix, exp) {
            var value;

            exp = new ExpressionParser(exp);
            value = me.tales(exp.tales());

            if (typeof value === 'undefined') {
                return prefix;
            } else if (typeof value === 'object') { // Dom
                var div = DomTal.cache.div;
                div.innerHTML = '';
                div.appendChild(value.cloneNode(true));
                value = div.innerHTML;
            }

            return prefix + value;
    });
};

// stringToDom
// -----------
//  Converts the given html text to a DOM Fragment
//
//      var html = 'This is an <em>html</em> string';
//      var fragment = tpl.stringToDom( html );
//
DomTal.prototype.stringToDom = function( html ) {
    var div, fragment;

    // let the browser parse the HTML string
    div = DomTal.cache.div;
    div.innerHTML = html;

    // create a document fragment and copy in it the parsed elements
    fragment = document.createDocumentFragment();
    while (div.firstChild) {
        fragment.appendChild( div.firstChild );
    }

    return fragment;
};

// makeIterable
// ------------
//  Returns an structure suited to be iterable from the supplied argument. This
//  method is used by the _repeat_ processor.
//
//  The returned iterable structure which looks like this
//
//      {
//          keys  : [], // the item keys as an array
//          values: [], // the item values as an array
//          count : 0   // the number of items
//      }
//
//  If you need to handle some special objects you can extend this method to
//  handle them, see the following example:
//
//      // Create a new object
//      function MyDOMTAL() {};
//      // Relate the new object to DomTal by prototype inheritance
//      MyDOMTAL.prototype = new DomTal();
//      // Extend the makeIterable method
//      MyDOMTAL.prototype.makeIterable = function( v ) {
//          if ( typeof v === 'object' && v.type === 'yourCustomObject') {
//                // Create an iterable structure for your custom object
//                YOUR CUSTOM CODE GOES HERE
//            } else {
//                // Just call the default method for native types
//                return DomTal.prototype.makeIterable.call(this, v)
//            }
//      }
//
//      var obj = { a: 'AAA', b: 'BBB' };
//      var iter = tpl.makeIterable(obj);
//      for (var i=0; i<iter.count; i++)
//          alert( 'Key: ' + iter.keys[i] + ' Value: ' + iter.values[i]);
//
DomTal.prototype.makeIterable = function( res ) {
    var i, k,
        data = {
            'keys'  : [],
            'values': [],
            'count' : 0
        };

    if ( bind.is(res) ) {
        return this.makeIterable(res());
    } else if ( res instanceof Array ) {
        data.keys = new Array(res.length);
        data.values = new Array(res.length);
        data.count = res.length;
        for (i=0; i<res.length; i++) {
            data.keys[i] = i;
            data.values[i] = res[i];
        }
    } else if ( typeof res === 'string' ) {
        data.values = res.split('');
        data.count = data.values.length;
        data.keys = new Array(data.count);
        for ( i=0; i<data.count; i++ ) {
            data.keys[i] = i;
        }
    } else if ( typeof res === 'object' ) {
        for (k in res) {
            if (res.hasOwnProperty(k)) {
                data.keys.push( k );
                data.values.push( res[k] );
            }
        }
        data.count = data.keys.length;
    } else if ( typeof res !== 'undefined' ) {
        data.keys.push( 0 );
        data.values.push( res );
        data.count = 1;
    }

    return data;
};

// get
// ---
//  Fetchs the contents of a variable defined by its name. If the variable is not 
//  found it returns `undefined`.
//
//      v = tpl.get('user');
//
DomTal.prototype.get = function(name, def) {
    var stack = this.stack,
        idx = stack.length;

    while (idx--) {
        if (name in stack[idx]) {
            return stack[idx][name];
        }
    }

    return def;
};

// set
// ---
//  Sets the contents of a variable in the template.
//
//      tpl.set( 'user', {firstname:'Joe', lastname:'Black'} );
//
//  We can assign a bunch of new values skipping the name and passing just an 
//  object as value. It will create variables for all of the object's properties.
//
//      tpl.set( { name: 'Mike', age: 22, email: 'mike@foo.bar' } );
//
DomTal.prototype.set = function(name, value) {
    var data = this.stack[this.stack.length-1];

    if (arguments.length === 2) {
        data[name] = value;
        return;
    }

    value = name;
    for (name in value) if (value.hasOwnProperty(name)) {
        data[name] = value[name];
    }
};

// log
// ---
//  Reports an error or warning while parsing a template. Replace it with your
//  own function to access the messages, by default nothing is done with them.
//
DomTal.prototype.log = function( msg ) {
    // do nothing by default
};

// process
// -------
//  Parses the given node element modifying it according to the template
//  instructions. You can pass a Document Fragment, a containing element or a
//  string.
//
//  Note: The root element passed shouldn't contain any processor since many
//  processors rely on the _parentNode_ to operate. Always use a Document
//  Fragment or a containing element such as a simple DIV.
//
//      tpl.process( myTemplateElement );
//      document.getElementById('holder').appendChild( myTemplateElement );
//
DomTal.prototype.process = function( node ) {
    var next, child,
        attrsNo,
        anode,
        p, processors = this.processors,
        recurse = true;

    // Create a new local data set for new scope
    this.stack.push({});


    function toArray(obj){
        var k, ret = [];
        for (k in obj) if (obj.hasOwnProperty(k)) {
            ret.push(obj[k]);
        }
        return ret;
    }


    function isNode(o){
        return typeof o === 'object' && typeof o.nodeType === 'number';
    }


    function insertMarker(processor, node, fragment){
        var m1, m2,
            ident = Math.floor(Math.random() * 10000000);

        if (!fragment || !fragment.hasChildNodes()) {
            m1 = fragment = document.createComment('DOMTAL:MARK id=' + ident + ' processor=' + processor);
            m1.ident = ident; m1.type = 'mark'; m1.processor = processor;
        } else {
            m1 = document.createComment('DOMTAL:BEGIN id=' + ident + ' processor=' + processor);
            m1.ident = ident; m1.type = 'begin'; m1.processor = processor;
            fragment.insertBefore(m1, fragment.firstChild);

            m2 = document.createComment('DOMTAL:END id=' + ident + ' processor=' + processor);
            m2.ident = ident; m2.type = 'end'; m2.processor = processor;
            fragment.appendChild(m2);
        }

        node.parentNode.replaceChild(fragment, node);

        return m1;
    }

    // Make a snapshot of a stack
    function makeSnapshot(stack){
        var k, depth = stack.length;
        snapshot = {};
        while (depth--) {
            for (k in stack[depth]) {
                if (stack[depth].hasOwnProperty(k) && !(k in snapshot)) {
                    snapshot[k] = stack[depth][k];
                }
            }
        }
    };

    
    // TODO: Can we defer the backup creation until it's actually needed?
    var bound;
    var snapshot;
    var backup = node.cloneNode(true);

    function fn(){

        // text node
        if (node.nodeType === 3) {

            // Create a new dependency tracking context
            bind.tracking.begin();

            // interpolate any variable pressent in the raw text
            node.nodeValue = this.interpolate( node.nodeValue );

            var deps = bind.tracking.end();
            deps = toArray(deps);
            if (!bound && deps.length) {

                if (!snapshot) makeSnapshot(this.stack);

                console.log('Setting up computed for text node...');
                bound = bind(function(){
                    node.nodeValue = this.interpolate(backup.nodeValue);
                }, {ctx: this}).depends(deps);
                bound.on(function(v){ 
                    var p = node.parentNode;
                    while (p && document !== p) p = p.parentNode;
                    if (!p) {
                        this.dispose()
                        console.log('text bound disposed');
                        return;
                    }
                    console.log('text bound called'); 
                });
            }

            // text nodes do not have child elements
            recurse = false;

        // element inside a container and with at least one attribute
        } else if (node.nodeType === 1 && node.parentNode && (attrsNo = node.attributes.length)) {

            var ns = this.ns;

            // check each processor to see if it's defined in the node
            //for (p in processors) if (processors.hasOwnProperty(p)) {
            processors.until(function(processor){
                if ( (anode = node.getAttributeNode(ns + processor.name)) ) {

                    // The return value from the processor tells what to do next:
                    //
                    //   - null : remove node (replace with a marker)
                    //   - false : do not process child nodes
                    //   - node : replace for the current node (and stop processing)
                    //   - fragment: replace for the current node (and stop processing)
                    //
                    // Any other return value (specially undefined) continues the normal
                    // processing of the current node and its children.

                    // Create a new dependency tracking context
                    bind.tracking.begin();

                    // Run the processor against the current node
                    recurse = processor.func.call(this, node, anode.value);

                    // Stop capturing dependencies
                    deps = bind.tracking.end();
                    console.log('Deps for "%s(%s)": %o', processor.name, anode.value, deps);


                    if (processor.type === DomTal.PROCTYPE.CONTENT) {
                        deps = toArray(deps);
                        if (!bound && deps.length) {
                            var exp = anode.value;

                            if (!snapshot) makeSnapshot(this.stack);

                            console.log('Binding content with %s', exp);

                            bound = bind(function(){
                                // Restore the template children
                                node.innerHTML = backup.innerHTML;

                                // Apply again the processor with the original expression
                                this.stack.push(snapshot);
                                processor.func.call(this, node, exp);
                                // TODO: The processor might want to have its child nodes
                                //       processed. We need to trigger it here.
                                this.stack.pop();


                            }, {ctx: this}).depends(deps);

                            bound.on(function(v){ 
                                var p = node.parentNode;
                                while (p && document !== p) p = p.parentNode;
                                if (!p) {
                                    this.dispose()
                                    console.log('content bound disposed');
                                    return;
                                }
                                console.log('content bound called'); 
                            });
                        }
                    }

                    if (processor.type === DomTal.PROCTYPE.REPLACE) {
                        deps = toArray(deps);
                        if (!bound && deps.length) {
                            console.log('Setting up computed...');

                            if (!snapshot) makeSnapshot(this.stack);

                            // Make a snapshot of the current stack
                            var i, k, depth = this.stack.length;
                            snapshot = {};
                            for (i=0; i<depth; i++) {
                                for (k in this.stack[i]) if (this.stack[i].hasOwnProperty(k)) {
                                    snapshot[k] = this.stack[i][k];
                                }
                            }

                            bound = bind(function(){
                                console.log('backup: %o', backup);
                                console.log('node: %o', node);

                                // Check if we're handling a section
                                if (node.nodeType === 8 && node.type === 'begin') {
                                    var ident = node.ident;
                                    // Remove all the siblings until we reach the end of the section
                                    while (nxt = node.nextSibling) {
                                        node.parentNode.removeChild(nxt);
                                        if (nxt.nodeType === 8 && node.type === 'end' && node.ident === ident) {
                                            break;
                                        }
                                    };
                                }

                                var newnode = backup.cloneNode(true);
                                node.parentNode.replaceChild(newnode, node);
                                node = newnode;
                                recurse = true;

                                this.stack.push(snapshot);
                                fn.call(this);
                                this.stack.pop();

                            }, {ctx: this}).depends(deps);
                            bound.on(function(v){ console.log('bound called'); });
                        } else if (bound && deps.length) {
                            bound.depends(deps);
                        }
                    }

                    if (processor.type === DomTal.PROCTYPE.DEFAULT) {

                    }

                    // By default we want to recurse any child nodes available
                    if (typeof recurse === 'undefined') {
                        recurse = true;
                    }


                    // We want to remove this node
                    if (null === recurse) {
                        node = insertMarker(processor.name, node);
                        recurse = false;
                        return;
                    }

                    // If the processor wants to replace the node we do so and stop.
                    if (isNode(recurse)) {
                        if (recurse.nodeType === 11) { 
                            node = insertMarker(processor.name, node, recurse);
                        } else {
                            node.parentNode.replaceChild(recurse, node);
                            node = recurse;
                        }

                        recurse = false;
                        return;
                    }

                    // if the processor has removed the node then just exit
                    if (!node || !node.parentNode) {
                        recurse = false;
                        return;
                    }

                    // find if the attribute is still there
                    anode = node.getAttributeNode(ns + p);
                    // if the attribute is still there and not IE then remove it
                    if ( /*@cc_on!@*/true && anode ) {
                        node.removeAttributeNode( anode );
                    }

                    // if no more attributes then we can stop looking for processors
                    if ( --attrsNo < 1 ) {
                        return;
                    }
                }

                return true;
            }, this);

            // Check remaining attributes to perform interpolation
            attrsNo = node && node.attributes ? node.attributes.length : 0;
            while (attrsNo--) {
                p = node.attributes[attrsNo].value;
                if (-1 !== p.indexOf('${')) {
                    node.attributes[attrsNo].value = this.interpolate(p);
                }
            }
        }

        // check if we have to check the node's children
        if (recurse) {
            // iterate over all the children with care since the DOM structure could change
            child = node.firstChild;
            while (child) {
                next = child.nextSibling;
                this.process( child );
                child = next;
            }
        }
    }

    fn.call(this);

    // remove the current local data set since it has run out of scope
    this.stack.pop();
};


// tales
// -----
//  Evaluates the given Tales expression returning the result.
//
//  - If the _default_ keyword is found then `DomTal.DEFAULT` value is returned
//  - If the _nothing_ keyword is found then `DomTal.NOTHING` value is returned
//
//      var result = tpl.tales(['bool:path.to.variable', 'default']);
//
DomTal.prototype.tales = function(exps, ref) {

    if (!exps || !exps.length) {
        throw new Error('Empty tales expressiong');
    }

    var i, len, exp,
        m, mod,
        result, error;

    for (i=0, len=exps.length; i<len; i++) {
        exp = exps[i];

        // Check special keywords
        if (/^\s*default\s*$/.test(exp)) {
            return DomTal.DEFAULT;
        } else if (/^\s*nothing\s*$/.test(exp)) {
            return DomTal.NOTHING;
        }

        // Find the desired tales prefix (modifier)
        mod = this.defMod;
        if (null !== (m = /^\s*([\w_-]+)\s*:/.exec(exps[i]))) {
            mod = this.modifiers[m[1]];
            if (!mod)
                throw new Error('Unknown tales modifier "' + m[1] + '" in "' + exps.join(' | ') + '"');

            exp = exp.substr(m[0].length);
        }

        try {
            result = mod.call(this, exp);
        } catch (e) {
            error = e;
        }
        if (typeof result !== 'undefined') break;
    }

    // throw the error if we couldn't find a valid result
    if (error && typeof result === 'undefined') {
        throw error;
    }

    return result;
};

// load
// ----
//  Prepares the given template to be used. Pass in as argument the template as a 
//  string, a script tag node object wrapping the template contents, a node object
//  defining the template as a DOM structure, a document fragment or an document
//  element Id by prefixing it with '#'.
//
//  It will always return a document fragment with the template as a DOM structure
//  or `false` if the template was not valid.
//
//  If the given template is not a document fragment this function will try to
//  convert it to one. This operation can take some time so if you're repeatedly 
//  loading the same template you should cache the result of this function once and 
//  use that cached result in following calls.
//
//      tpl.load( document.getElementById('myTemplate') );
//      tpl.load( '#myTemplate' );
//      tpl.load( '<strong tal:content="username">drslump</strong>' );
//
DomTal.prototype.load = function( tpl ) {
    if (typeof tpl === 'string') {
        if (tpl.charAt(0) === '#') {
            // fetch an element by its ID attribute
            return this.load( document.getElementById( tpl.substring(1) ) );
        }
        // a string to convert to a document fragment
        this.tpl = this.stringToDom( tpl );
    } else if ( tpl.nodetype === 11 ) {
        // a document fragment so use it directly
        this.tpl = tpl;
    } else if ( tpl.nodeType === 1 && tpl.nodeName.toLowerCase() === 'script' ) {
        // a script element so get the inline contents as a string and parse it
        tpl = tpl.innerHTML;
        // filter out the comment or CDATA preffix and suffix
        tpl = tpl.replace(/^\s*<!(--|\[CDATA\[)/i, '').replace(/(--|]])>\s*$/i, '');
        // convert the string to document fragment
        this.tpl = this.stringToDom( tpl );
    } else if ( tpl.nodeType === 1 ) {
        // a containing element so clone its contents
        this.tpl = document.createDocumentFragment();
        var i;
        for (i=0; i<tpl.childNodes.length; i++) {
            this.tpl.appendChild( tpl.childNodes[i].cloneNode(true) );
        }
    } else {
        // not a valid template source
        this.tpl = null;
        return false;
    }

    return this.tpl;
};


// run
// ---
//  Parses the template and returns the final result. Optionally set the data to
//  feed the template if not done already with the `set` method.
//
//  Returns a document fragment with the result of the template execution or false
//  if an error happened.
//
//      dom = tpl.run({foo:'Foo', bar:'Bar'});
//      document.body.appendChild(out);
//
DomTal.prototype.run = function(data) {
    var result;

    if (data) {
        this.set(data);
    }

    if (!this.tpl) {
        throw new Error('No template was loaded, unable to perform the action');
    }

    // Make a copy of the template and process it
    result = this.tpl.cloneNode(true);
    this.process(result);

    return result;
};




// TAL Processors
// ==============
// 
//  - Here are implemented the standard set of TAL processors. The order in
//    which they are defined is important so do not refactor it.
//  - The functions are called with the <DomTal> object in the _this_ variable
//    so you can use the methods from <DomTal>.
//
//  The functions take two arguments:
//  - the first argument is the document element node in which that processor is
//    defined.
//  - the second argument is the tales expression to parse
//
DomTal.prototype.processors = new WeightedList();

// Registers a new processor
//
// TODO: Override existing processors with the same name
DomTal.prototype.processor = function(name, priority, type, fn){
    if (arguments.length === 2) {
        fn = priority;
        priority = DomTal.PRIO.AVERAGE;
        type = DomTal.PROCTYPE.DEFAULT;
    } else if (arguments.length === 3) {
        fn = type;
        type = DomTal.PROCTYPE.DEFAULT;
    }

    this.processors.add({
        name: name,
        type: type,
        func: fn
    }, priority);
};


// define
// ------
//  Defines one or more variables which may be used later in the template.
//  To separate the variable definitions use a semi-colon. To declare a
//  global variable use the _global_ prefix, otherwise the variable will be
//  declared as local and will only be available to the current node and
//  its children.
//
//      define="[global] VarName [TalesExpression|structure]"
//
//  - Empty elements with this processor are not removed from the template,
//    use _omit-tag_ to accomplish that behaviour.
//  - If no tales expression is supplied or it's _structure_ then the
//    contents of the tag are assigned to the variable, in that case it'll be
//    added as a document fragment not as a string.
//
// Example of how to make a global shortcut to a long path
//
//      <span tal:define="global destname path/to/existing/variable" />
//
// Assigning the contents of an element to a variable
//
//      <span tal:define="global myvar structure"
//            tal:omit-tag="1">
//        This is a <strong>string</strong>
//      </span>
//
// Defining a local variable
//
//      <span tal:define="myLocalVar js:new Array(10)"
//            tal:repeat="item myLocalVar" tal:content="item">
//      </span>
//
DomTal.prototype.processor('define', DomTal.PRIO.MAX, DomTal.PROCTYPE.DEFAULT, function(node, exp){
    var i, value, def, tales, data;

    exp = new ExpressionParser(exp);

    while (true) {
        // First is either the global keyword or the define name
        def = exp.ident();
        if (def === 'global') {
            data = this.stack[0] 
            def = exp.ident();
        } else {
            data = this.stack[this.stack.length-1];
        }

        if (def === null) {
            throw new Error('Expected an identifier at ' + exp.pos + ' in "' + exp.exp + '"');
        }

        // Now comes a tales expression
        tales = exp.tales();
        if (tales === null) {
            throw new Error('Expected a tales expression at ' + exp.pos + ' in "' + exp.exp + '"');
        }
        value = this.tales(tales);

        // Copy and process child nodes if want to store the defaults
        if (value === DomTal.DEFAULT) {
            value = document.createDocumentFragment();
            for (i=0; i<node.childNodes.length; i++) {
                n = node.childNodes[i].cloneNode(true);
                value.appendChild(n);
                this.process(value.lastChild);
            }
        } else if (value === DomTal.NOTHING) {
            continue;
        }

        data[def] = value;

        if (!exp.str(';')) break;
    }

    // process the child nodes
    return true;
});

// condition
// ---------
//  The entity and its contents will be shown only if the expression
//  evaluates to true.
//
//      condition="TalesExpression"
//
//  The preferable way is to use boolean like variables
//
//      <span tal:condition="cart/isEmpty">
//          No items in your cart
//      </span>
//
//  We can also use javascript code for special conditions
//
//      <span tal:condition="js: ${cart/items}.length < 1">
//          No items in your cart
//      </span>
//
DomTal.prototype.processor('condition', DomTal.PRIO.VERYHIGH, DomTal.PROCTYPE.REPLACE, function (node, exp){
    var tales, value;

    exp = new ExpressionParser(exp);

    tales = exp.tales();
    if (tales === null) {
        throw new Error('Expected a tales expression in "' + exp.exp + '"');
    }

    value = this.tales(tales);

    if (bind.is(value)) {
        value = value();
    }

    return value ? true : null;
});

// repeat
// ------
//  Provides repetition for iterable data like arrays or objects. The repeat attribute 
//  creates a new instance of its containing node for each item available in the 
//  iterable structure.
//
//      repeat="item TalesExpression"
//
//  Within the repetition, you can access the current loop information (and that of
//  its parent for nested loops) using specific repeat/ paths. In the following table 
//  _item_ is the name of the receiver variable used in the repeat processor.
//
//      repeat.item.index   - returns the item index (0 to count-1)
//      repeat.item.number  - returns the item number (1 to count)
//      repeat.item.even    - returns true if the item index is even
//      repeat.item.odd     - returns true if the item index is odd
//      repeat.item.start   - returns true if the item is the first one
//      repeat.item.end     - returns true if the item is the last one
//      repeat.item.length  - returns the number of elements in the resource
//      repeat.item.key     - returns the item's key
// 
//  One common use case of this processor is to populate a table with data
//
//      <table>
//      <thead>
//        <tr>
//          <th>Position</th> <th>Player</th> <th>Score</th>
//         </tr>
//        </thead>
//        <tbody>
//          <tr tal:repeat="ranking playersRanking">
//            <td tal:content="repeat.ranking.index"/>
//            <td tal:content="ranking.player"/>
//            <td tal:content="ranking.score"/>
//          </tr>
//        </tbody>
//    </table>
//
DomTal.prototype.processor('repeat', DomTal.PRIO.HIGH, DomTal.PROCTYPE.REPLACE, function(node, exp){
    var data, meta, tales, item, value, tpl;

    // Store the node as a template
    tpl = node;

    // if we are in a loop then process its children normally
    if (tpl.getAttribute('domtal_repeat')) {
        tpl.removeAttribute('domtal_repeat');
        return true;
    }

    // mark the node as a repeated item template
    tpl.setAttribute('domtal_repeat', 'true');

    // Parse the expression, an identifier followed by a tales expression
    exp = new ExpressionParser(exp);
    item = exp.ident();
    tales = exp.tales();

    value = this.makeIterable( this.tales(tales) );

    data = this.stack[ this.stack.length-1 ];
    if (typeof data.repeat === 'undefined') {
        data.repeat = {};
    }

    // Initialize the meta data object
    meta = data.repeat[item] = {};

    // Create a fragment to hold all the repetitions
    var fragment = document.createDocumentFragment();

    // Loop over all the data set
    for (var i=0, len=value.count; i<len; i++) {
        // Update the meta information
        meta.index = i;
        meta.number = i+1;
        meta.odd = !(i%2);
        meta.even = !meta.odd;
        meta.start = i === 0;
        meta.end = i === len-1;
        meta.length = len;
        meta.key = value.keys[i];

        data[item] = value.values[i];

        node = tpl.cloneNode(true);
        fragment.appendChild(node);

        // Process the template
        this.process(node);
    }

    return fragment;
});

// replace
// -------
//  Replaces the containing node with the result of an expression, even if the expression
//  resolves to an empty value.
//
//      <span tal:replace="myvar">
//        This text will be replaced by the contents of myvar
//        even removing the span tag around it
//      </span>
//
DomTal.prototype.processor('replace', DomTal.PRIO.ABOVE, DomTal.PROCTYPE.REPLACE, function(node, exp){
    var tales, value;

    exp = new ExpressionParser(exp);
    tales = exp.tales();

    value = this.tales(tales) || '';

    if (value === DomTal.DEFAULT) {
        return true;
    }

    // check if we want to include a DOM Node or fragment
    if (value && typeof value.nodeType === 'number') {
        node.parentNode.replaceChild(value, node);
    } else if (value === DomTal.NOTHING) {
        return null;
    } else {
        var text = document.createTextNode(value);
        node.parentNode.replaceChild(text, node);
        return text;
    }

    return true;
});

// content
// -------
//  Sets new contents for the containing node.
//
//      <span tal:content="myvar">
//        This text will be replaced by the contents of myvar
//      </span>
//
DomTal.prototype.processor('content', DomTal.PRIO.AVERAGE, DomTal.PROCTYPE.CONTENT, function(node, exp){
    var tales, value;

    exp = new ExpressionParser(exp);
    tales = exp.tales();

    value = this.tales(tales);

    if (value === DomTal.DEFAULT) {
        return true;
    }

    // check if we want to include a DOM Node
    if (value && typeof value.nodeType === 'number') {
        node.innerHTML = '';
        node.appendChild(value);
        return true;
    }

    if (value === DomTal.NOTHING) value = '';

    if (/*@cc_on!@*/false) {
        node.innerText = value;
    } else {
        node.textContent = value;
    }

    return false;
});

// attributes
// ----------
//  Defines or overrides attributes in the current node.
//
//      attributes="name TalesExpression [; name TalesExpression]"
//
//  You can separate the name and the tales expression either by an space, with a colon ':'
//  or with an equal '='. Attributes can be separated by using a semi-colon ';' or just a
//  simple comma ','.
//
//      <a href="http://www.foo.com"
//         tal:attributes="href link.url; style 'color: red; background: yellow'">
//           This link will point to ${link.url} with red text over a yellow background
//      </a>
//
DomTal.prototype.processor('attributes', DomTal.PRIO.LOW, DomTal.PROCTYPE.DEFAULT, function(node, exp){
    var attr, tales, value;

    exp = new ExpressionParser(exp);

    do {

        attr = exp.rex(/^\s*([a-z][a-z0-9_-]*)/i);
        if (null === attr)
            throw new Error('Expected attribute name at ' + exp.pos + ' in "' + exp.exp + '"');

        // It's not in the spec but we optionally support a colon or equal as separator.
        exp.str(':');
        exp.str('=');

        tales = exp.tales();
        if (null === tales)
            throw new Error('Expected tales expression at ' + exp.pos + ' in "' + exp.exp + '"');

        // Work around IE bug (http://webbugtrack.blogspot.com/2007/11/bug-299-setattribute-checked-does-not.html)
        if (/*@cc_on!@*/false && attr.toLowerCase() === 'checked') {
            attr = 'defaultChecked';
        }

        value = this.tales(tales);

        if (value === true) {
            node.setAttribute(attr, attr);
        } else if (value === false || value === DomTal.NOTHING) {
            node.removeAttribute(attr);
        } else if (value !== DomTal.DEFAULT) {
            node.setAttribute(attr, value);
        }

    } while( exp.str(';') || exp.str(',') );

    return true;
});


// omit-tag
// --------
//  Makes the parser skip the containing node if no expression is given or if it evaluates 
//  to true. The contents of the tag will however be parsed and included in the output.
//
//      <span tal:omit-tag="myvar">
//          If myvar evaluates to true this text will appear without the span 
//          tag surrounding it
//      </span>
//
DomTal.prototype.processor('omit-tag', DomTal.PRIO.VERYLOW, DomTal.PROCTYPE.REPLACE, function(node, exp){
    var tales, value;

    exp = new ExpressionParser(exp);
    tales = exp.tales();
    value = tales ? this.tales(exp) : true;

    if (!value) {
        return true;
    }

    // Move the children to a fragment so we can replace this node with them
    value = document.createDocumentFragment();
    while (node.firstChild) {
        value.appendChild(node.firstChild);
    }

    return value;
});

// -----------------------------------------------------------------------

// TALES modifiers
// ===============
//
// Expression chains
// -----------------
//  An expression chain is a list of expressions separated by the '|' character.
//  While evaluating those expressions, DOM TAL will stop its evaluation when an
//  expression value is not null and no error was raised.
//
//      "page/title | page/alternativeTitle | 'No Title'"
//
//
// The _default_ keyword
// ---------------------
//  This allows template designers to keep the content of a tag as an
//  alternative value if an error occurs or if something is not defined. It
//  should be used as the last element of an _expression chain_.
//
//      <h1 tal:content="page/title | default">
//          This title will be shown if page/title is empty
//      </h1>
//
// The _structure_ keyword
// -----------------------
//
//  This keyword can be used as a prefix for a variable to indicate that we want
//  to include its content as a _document fragment_ instead of a string.
//
//  This will insert inside the div the HTML elements defined in 'myvar' instead
//  of inserting the variable as a string which is the default behaviour.
//
//      <div tal:content="structure myVar" />
//
// Extending
// ---------
//  You can create your own modifiers by extending the DomTal.modifiers
//  object. The modifier functions take as only argument the tales expression
//  to evaluate.
// 
// -----------------------------------------------------------------------

DomTal.prototype.modifiers = {

    // path
    // ----
    //  *Deprecated*. The default modifier is now to evaluate the expression as
    //  a Javascript statement.
    //
    //  This is the default modifier, it evaluates the given expression as a
    //  variable path. Aditionally you can also use numbers (integers and
    //  floats) and the boolean keywords _true_ and _false_.
    //
    //      <span tal:content="user/name" />
    //      <span tal:content="path: user/email" />
    //
    path: function DomTal_modifiers_path(exp, ref) {
        var v;

        // check if it's a number
        if ( (m = exp.match(/^\s*(-?[0-9]+(\.[0-9]+)?)\s*$/)) ) {
            return parseFloat(m[1]);
        // check if it's true or false
        } else if ( (m = exp.match(/^\s*(true|false)\s*$/i)) ) {
            return (m[1].toLowerCase() === 'true');
        // check if it's a structure
        } else if ( (m = exp.match(/^\s*structure\s+(.+)$/)) ) {
            v = this.getByPath( m[1], ref );
            if (!v) {
                return null;
            } else if (typeof v === 'string') {
                return this.stringToDom( v );
            } else {
                return v;
            }
        }

        // otherwise it should be a path, check for its variable
        return this.getByPath( exp, ref );
    },

    // exists
    // ------
    //  This modifier returns true if the given path exists or false if it does
    //  not.
    //
    //      <span tal:condition="exists: user">
    //          Welcome ${user/name}
    //      </span>
    //
    exists: function DomTal_modifiers_exists( exp ) {
        var value = this.tales([exp]);
        return (typeof value !== 'undefined');
    },

    // not
    // ---
    //  This modifier just negates the result of the given expression. It's
    //  specially useful when used in the _condition_ processor.
    //
    //      <span tal:condition="not: cart/items">
    //        There are no items in your cart
    //      </span>
    //
    not: function DomTal_modifiers_not( exp ) {
        return !this.tales([exp]);
    },

    // string
    // ------
    //  *Deprecated*. This prefix is no longer available.
    //
    string: function DomTal_modifiers_string( str ) {
        throw new Error('The "string:" prefix has been deprecated');
    },

    // js
    // --
    //  This modifier evaluates the expression as plain Javascript code after
    //  interpolating the expression for any variables.
    //
    //  Try to not abuse this modifier, the code is passed thru eval() which
    //  would make its debugging more difficult. Moreover, the tales parser is
    //  quite weak so it's possible that any non simple javascript literal could
    //  break it.
    //  If you need a special functionality try creating a custom modifier, they
    //  are very easy to implement and should also be a bit faster than eval'd
    //  code.
    //
    //  This will make a list with 10 items in it from 0 to 9
    // 
    //      <ul tal:repeat="elem js: new Array(10)">
    //          <li tal:content="repeat/elem/index" />
    //      </ul>
    //
    //  This will do the same but the number of items is defined in a variable
    //
    //      <ul tal:repeat="elem js: new Array(${path/to/numItems})">
    //          <li tal:content="repeat/elem/index" />
    //      </ul>
    //
    js: function(exp){
        var rex = /(['"\/\\\.])|([A-Za-z$_]+)/g,
            keywords = [
                'break', 'case', 'catch', 'const', 'continue',
                'debugger', 'default', 'delete', 'do',
                'else', 'enum',
                'false', 'finally', 'for', 'function',
                'if', 'in', 'instanceof',
                'new', 'null', 'return', 'switch',
                'this', 'throw', 'true', 'try', 'typeof',
                'var', 'void', 'while', 'with'
            ];

        function compile(exp){
            var quoted = false, backslash = false, dot = false;

            return exp.replace(rex, function(m0, ch, ident){
                if (ch) {
                    switch (ch) {
                    case '\\':
                        backslash = !backslash;
                        dot = false;
                        return ch;
                    case '.': 
                        backslash = false;
                        dot = true;
                        return ch;
                    default:
                        if (!quoted) quoted = ch;
                        else if (quoted === ch && !backslash) quoted = false;
                        backslash = dot = false
                        return ch;
                    }
                } else if (ident) {
                    if (dot || quoted || -1 !== keywords.indexOf(ident)) {
                        backslash = dot = false;
                        return ident;
                    }

                    backslash = dot = false;
                    return "(THIS.get('" + ident + "', THIS.env['" + ident + "']))";
                }
            });
        }

        var fn, value, 
            cache = DomTal.cache.js;

        if (exp in cache) {
            fn = cache[exp];
        } else {
            // Optimize the simplest case which is just obtaining a top level variable
            if (/^[A-Za-z$_][A-Za-z0-9$_]*$/.test(exp)) {
                return this.get(exp, this.env[exp]);
            }

            // Create a function instead of evaling the compiled code since Function is
            // safer and is supposed to be easier to optimize by Javascript engines.
            fn = cache[exp] = new Function('THIS', 'return (' + compile(exp) + ')');
        }

        try {
            value = fn.call(this.stack[0], this, exports);
        } catch (e) {
            var err, msg = e.message;

            // Try to clean up the error message a bit
            msg = e.message.replace(/\(*THIS\.get\(['"]([^'"]+)[^)]+\)+/g, '$1');

            // Wrap the exception with our own to customize the message
            err = new Error(msg + '. Evaluating tales expression "' + exp + '"');
            err.prototype = e;
            throw err;
        }

        return value;
    },

    // bool
    // ----
    //  This modifier casts the expression value to a boolean. It understands strings
    //  with Yes/No, On/Off and True/False. A string of '0' is casted to false.
    //
    //      <input type="checkbox" tal:attributes="checked bool:user/active" />
    //
    bool: function DomTal_modifiers_bool(exp){
        var value;

        value = this.tales([exp]);

        if (typeof value === 'string') {
            if (/^[0-9\.]+$/.test(value) && parseInt(value, 10) == value) {
                value = parseInt(value, 10);
            } else if (/^(no|off|false)$/i.test(value)) {
                value = false;
            }
        }

        return !!value;
    },

    // int
    // ---
    //  This modifier casts the expression value to an integer
    //
    //      <span>${int:user/age}</span>
    // 
    'int': function DomTal_modifiers_int(exp){
        var value;

        value = this.tales([exp]);
        value = parseInt(value, 10);

        return isNaN(value) ? 0 : value;
    },

    // float
    // -----
    //  This modifier casts the expression value to a float 
    // 
    //      <span>${float:item/ratio}</span></span>
    //
    'float': function DomTal_modifiers_float(exp){
        var value;

        value = this.tales([exp]);
        value = parseFloat(value);

        return isNaN(value) ? 0.0 : value;
    }
};


// Exports
// =======

exports.DomTal = DomTal;
exports.DomTal.ExpressionParser = ExpressionParser;


})(typeof exports !== 'undefined' ? exports : this);
