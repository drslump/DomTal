// DomTal 2.0 - A TAL templates engine for javascript.
// 
// copyright (c) 2005-2012 Iván -DrSlump- Montes <http://pollinimini.net>
// 
// Distributed under the MIT license

(function(exports) { "use strict";

// -----------------------------------------------------------------------------
//
// Credits
// -------
//
//   - Originated from work by Joachim Zobel <http://www.heute-morgen.de/test/About_DOMTAL.html>
//  
// Known issues
// ------------
//
//  - This script uses the own browser to parse the html, so you must be carefull 
//    with the validity of the code. A common mistake is to use the short syntax 
//    `<tag />` for elements which shouldn't according to the standard.
//    It's always a good idea to use the full syntax (except for `<br/>` and `<hr/>`) 
//    even when no content is defined.
//
//  - In Internet Explorer the tal attributes (processors) can't be removed from
//    the generated code although this shouldn't affect anything.
//
// Differences with standard TAL
// -----------------------------
//
//  - The default tales prefix/modifier is _js_, which resolves a basic javascript
//    statement instead of a path to a variable.
//  - No support for `tal:on-error` processor.
//  - No support for `Metal`, however a similar behaviour can be mimicked with
//    document fragments and common tal processors.
//  - `omit-tag` works a bit differently. If the tales expression evaluates to true 
//    the tag is removed and its contents shown, otherwise the tag is also shown.
//    This is an intended change and can be easily removed by creating a custom
//    wrapper for this processor.
//  - `structure` is a modifier instead of a keyword. ie: "structure:myhtml".
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
//  Note that you can also use a node with name `tal:block` when you are going to
//  replace it with some other content. Just remember to close the tag properly without
//  using short syntax (ie: `<tal:block ... />`). It allows to define tal attributes
//  without using the prefix in them.
//
//      <tal:block replace="item"></tal:block>
//
//  Although since it's required to close the element it often times prefered to use the
//  `<hr>` or `<br>` tags in these cases when no default content is defined, thus not 
//  requiring a close the tag.
//
//      <hr tal:replace="item">
//
//  And that's it. There a few more options but overall it's a pretty easy to
//  use library.
//
//
// Performance
// ===========
//
//  Most operations are implemented by creating a special node called a Document Fragment,
//  which contains the new elements to include in the page. Besides popular believe, the
//  Browser's DOM API is not very slow, what's important is to modify the DOM when it's not
//  yet included in the Document. In fact, Document Fragments are faster than using innerHTML
//  to feed a string with serialized HTML, and they are faster by a good 25% in all major 
//  browsers.
//  
//  Thus while it's true that if you just use a template once DomTal is slower than string 
//  based template solutions, the benefits of working with a DOM outperform this initial
//  slowness in many real world use cases.
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
//      <span tal:attributes="class oddeven:3">foo</span>
//
//  will produce
//
//      <span class="odd">foo</span>
//
// ----------------------------------------------------------------

// Detect old Internet Explorer (<9) by abusing their lack of support
// for the vertial tab escape.
var isIE = '\v' === 'v';

// Private variable to build unique identifiers
var uniqueId = 1;

//
// Create some static caches to be shared among all instances
//
var cache = {
    js: {}, // cache for compiled tales expressions

    // Pre-generate some node containers for different types of template contents
    div: document.createElement('div'),
    tbody: document.createElement('tbody'),
    tr: document.createElement('tr'),
    ul: document.createElement('ul'),
    dl: document.createElement('dl')
};

//
// Dummy dependency tracker used when Bind is not available
//
var mockDepTracking = {
    begin: function(){},
    end: function(){ return []; }
};


// load
// ----
//  Prepares the given template to be used. Pass in as argument the template as a 
//  string, a script tag node object wrapping the template contents, a node object
//  defining the template as a DOM structure, a document fragment or an document
//  element Id by prefixing it with '#'.
function load(tpl) {
    var ret = null;

    if (!tpl) {
        return ret;
    }

    if (typeof tpl === 'string') {
        if (tpl.charAt(0) === '#') {
            // fetch an element by its ID attribute
            return load( document.getElementById( tpl.substring(1) ) );
        }
        // a string to convert to a document fragment
        ret = stringToDom( tpl );
    } else if ( tpl.nodeType === 11 ) {
        // a document fragment so use it directly
        ret = tpl;
    } else if ( tpl.nodeType === 1 && tpl.nodeName.toLowerCase() === 'script' ) {
        // a script element so get the inline contents as a string and parse it
        ret = tpl.innerHTML;
        // filter out the comment or CDATA preffix and suffix
        ret = ret.replace(/^\s*<!(--|\[CDATA\[)/i, '').replace(/(--|]])>\s*$/i, '');
        // convert the string to document fragment
        ret = stringToDom(ret);
    } else if ( tpl.nodeType === 1 ) {
        // a containing element so clone its contents
        ret = document.createDocumentFragment();
        for (var i=0; i<tpl.childNodes.length; i++) {
            ret.appendChild( tpl.childNodes[i].cloneNode(true) );
        }
    }

    return ret;
}

// stringToDom
// -----------
//  Converts the given html text to a DOM Fragment
//
//      var html = 'This is an <em>html</em> string';
//      var fragment = stringToDom( html );
//
function stringToDom( html ) {
    var cont, fragment;

    // let the browser parse the HTML string. Since the browser applies special rules
    // according to different node name semantics we have to choose a propper container
    // for the template contents.
    if (/^\s*<tr\b/i.test(html)) {
        cont = cache.tbody;
    } else if (/^\s*<t[dh]/i.test(html)) {
        cont = cache.tr;
    } else if (/^\s*<li\b/i.test(html)) {
        cont = cache.ul;
    } else if (/^\s*<d[dt]\b/i.test(html)) {
        cont = cache.dl;
    } else {
        cont = cache.div;
    }

    cont.innerHTML = html;

    // create a document fragment and copy in it the parsed elements
    fragment = document.createDocumentFragment();
    while (cont.firstChild) {
        fragment.appendChild(cont.firstChild);
    }

    return fragment;
}


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
                break;
            }

            // Expressions might be contained inside parens or braces.
            // We need to stop processing the expression once we get unbalanced.
            if (eos > 0 && balanced < 0) {
                this.skip(-token.length);
                break;
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
        if (p.procname === name) {
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

WeightedList.prototype.removeByName = function(name){
    var i, 
        items = this._items, map = this._map, weights = this._weights, 
        len = map.length;

    for (i=0; i<len; i++){
        if (items[ map[i] ].procname === name) {
            items.splice(map[1], 1);
            map.splice(i, 1);
            weights.splice(i, 1);
            break;
        }
    }
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
        this.load(tpl);
    }

    this.ns = ns ? ns : 'tal';
    this.ns += ':';

    // If set to false tal processor attributes will be kept in the generated DOM
    this.removeAttrs = true;

    // Setup the data bucket
    this.stack = [];
    this.stack.push( data ? data : {} );

    // Default modifier for tales expressions
    this.defMod = this.modifiers.js;

    this.tracker = typeof bind !== 'undefined' ? bind.tracking : mockDepTracking;
}

// Constants
// ---------
//  We compare with === so we can use an empty object instance to detect them 
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


// Offer a 'static' method to easily load a template into a new instance
DomTal.load = function(tpl){
    var dt = new DomTal();
    dt.load(tpl);
    return dt;
};

// Offer a 'static' method to easily parse and execute a template
DomTal.run = function(tpl, data){
    var dt = DomTal.load(tpl);
    return dt.run(data);
};


// By default we allow access to the global Javascript context. This allows
// to use external helpers like underscore's function to work with arrays.
// Override this property with your own object to limit access to the environment
// from the templates in order to sandbox their execution.
DomTal.prototype.env = exports;


// interpolate
// -----------
//  Interpolates the given text with the current set of variables.
//
DomTal.prototype.interpolate = function( txt ) {
    var value, tales, out = [], 
        div = cache.div,
        parser = new ExpressionParser(txt);

    while (parser.pos < txt.length) {
        value = parser.rex(/^[^$]+/);
        if (value !== null) {
            out.push(value);
        }

        if (parser.str('${')) {
            tales = parser.tales();
            if (tales === null) {
                throw new Error('Invalid tales expression "' + parser + '"');
            }

            value = this.tales(tales);
            if (value !== DomTal.NOTHING && typeof value !== 'undefined') {
                if (typeof value === 'object') { // DocumentFragment
                    div.innerHTML = '';
                    div.appendChild(value.cloneNode(true))
                    value = div.innerHTML;
                }
                out.push(value);
            }

            parser.str('}');
        } else {
            // Consume next two chars since it might be a escaped $$ sign
            out.push(parser.consume(2));
        }
    }

    return out.join('');

    /*
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
                var div = cache.div;
                div.innerHTML = '';
                div.appendChild(value.cloneNode(true));
                value = div.innerHTML;
            }

            return prefix + value;
    });

    */
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

// Obtain the closest frame object from the stack containing the a value under
// the given name.
// TODO: The name is horrible. Change it for something better :)
DomTal.prototype.getFrame = function(name) {
    var stack = this.stack,
        idx = stack.length;
    while (idx--) {
        if (name in stack[idx]) {
            return stack[idx];
        }
    }

    return null;
};

// set
// ---
//  Sets the contents of a variable in the template.
//
//      tpl.set( 'user', {firstname:'Joe', lastname:'Black'} );
//
//  We can replace the current values by skipping the name and passing just an 
//  object as value. It will assign that object to the current stack level, making
//  its properties available to the template.
//
//      tpl.set( { name: 'Mike', age: 22, email: 'mike@foo.bar' } );
//
DomTal.prototype.set = function(name, value) {
    var stack = this.stack, len = stack.length;

    if (arguments.length === 2) {
        stack[len-1] = value;
        return;
    }

    stack[len-1] = name;
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
        for (k in obj) {
            if (obj.hasOwnProperty(k)) {
                ret.push(obj[k]);
            }
        }
        return ret;
    }

    function isNode(o){
        return typeof o === 'object' && typeof o.nodeType === 'number';
    }

    function insertMarker(processor, node, fragment){
        var m1, m2,
            ident = uniqueId++;

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


    // TODO: Can we defer the backup creation until it's actually needed?
    //var bound;
    //var snapshot;
    //var backup = node.cloneNode(true);

    this.render(node);

    // remove the current local data set since it has run out of scope
    this.stack.pop();
};


/*
############################################################

NEW ALGORITHM

  - Collect dependencies for CONTENT and REPLACE processors only
  - Aggregate dependencies per NODE!!!
  - Once the node has been processed check if there are dependencies
  - Setup a computed to trigger again the render using a snapshot and the node in a closure
  - When the computed is made, following executions will not replace it, they just update the
    list of dependencies.

TODO:
  - What to do when the backup node is no longer hanging from a valid template?

############################################################
*/

DomTal.prototype.render = function(node, bound){

    function isNode(o){
        return typeof o === 'object' && typeof o.nodeType === 'number';
    }

    function insertMarker(processor, node, fragment){
        var m1, m2,
            ident = uniqueId++;

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


    var deps, snapshot, backup;
    var recurse = true;
    var alldeps = [];
    var attrsNo;

    // text node
    if (node.nodeType === 3) {

        // interpolate any variable pressent in the raw text
        var tmp = node.nodeValue;
        if (-1 !== tmp.indexOf('$')) {
            // Backup the node only if we don't have a bound callback yet
            if (!backup && !bound) {
                backup = node.cloneNode(true);
            }

            // Create a new dependency tracking context
            this.tracker.begin();
            node.nodeValue = this.interpolate(tmp);
            alldeps = this.tracker.end();
        }

        // text nodes do not have child elements
        recurse = false;

    // element inside a container and with at least one attribute
    } else if (node.nodeType === 1 && node.parentNode && (attrsNo = node.attributes.length)) {

        var processors = this.processors,
            foundAttrs = [],
            anode;

        var ns = this.ns;
        if (node.nodeName.toLowerCase().indexOf(ns) === 0) {
            ns = '';
            // Specify an omit-tag if it's not set so that the custom element
            // gets removed from the generated DOM by default
            if (!node.getAttributeNode('omit-tag')) {
                // TODO: Doesn't work :-(
                //node.setAttribute('omit-tag', '1');
                //attrsNo++;
            }
        }

        // check each processor to see if it's defined in the node
        //for (p in processors) if (processors.hasOwnProperty(p)) {
        processors.until(function(processor){
            anode = node.getAttributeNode(ns + processor.procname);
            if (!anode) {
                return true;
            }

            var isDestructive = processor.proctype === DomTal.PROCTYPE.CONTENT || 
                                processor.proctype === DomTal.PROCTYPE.REPLACE;

            // Backup the node, if we haven't already, before we perform any modification
            if (isDestructive && !backup) {
                backup = node.cloneNode(true);
            }

            // Keep a reference to the processed attribute to remove it later
            foundAttrs.push(anode);

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
            this.tracker.begin();
            // Run the processor against the current node
            recurse = processor.call(this, node, anode.value);
            // Stop capturing dependencies
            deps = this.tracker.end();

            if (isDestructive) {
                alldeps = alldeps.concat(deps);
            }

            // By default we want to recurse any child nodes available
            if (typeof recurse === 'undefined') {
                recurse = true;
            // We want to remove this node
            } else if (null === recurse) {
                node = insertMarker(processor.procname, node);
                recurse = false;
                return;
            // If the processor wants to replace the node we do so and stop.
            } else if (isNode(recurse)) {
                if (recurse.nodeType === 11) { 
                    node = insertMarker(processor.procname, node, recurse);
                } else {
                    if (!node.parentNode) {
                        console.log('DOMTAL ERROR! No parentNode found when replacing a node')
                    } else {
                        node.parentNode.replaceChild(recurse, node);
                    }
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

            // if no more attributes then we can stop looking for processors
            attrsNo--;
            if ( attrsNo < 1 ) {
                return;
            }

            return true;
        }, this);

        // remove processed attributes. Internet Explorer does not allow to remove
        // node attributes.
        if (this.removeAttrs && !isIE && node && node.nodeType === 1) {
            while(anode = foundAttrs.pop()) {
                node.removeAttributeNode(anode);
            }
        }

        // Check remaining attributes to perform interpolation. Internet Explorer returns
        // all the possible attributes for the element, even if they have not been defined.
        attrsNo = node && node.attributes ? node.attributes.length : 0;
        while (attrsNo--) {
            var p = node.attributes[attrsNo].value;
            if (p && -1 !== p.indexOf('${')) {
                node.attributes[attrsNo].value = this.interpolate(p);
            }
        }
    }

    // Setup bound renderer if not done already
    if (!bound && alldeps.length) {
        console.log('Setting up computed for node...', alldeps);
        snapshot = this.stack.slice(0);
        bound = bind(function(){
            var stackBackup, newnode;

            console.log('Running computed');

            // We need to replace it before processing it to make sure it has a parent node
            newnode = backup.cloneNode(true);

            // Make sure it has a parent node
            cache.div.appendChild(newnode);

            // Swap the stack for the snapshoted version
            stackBackup = this.stack;
            this.stack = snapshot;
            // Perform the rendering
            newnode = this.render(newnode, bound);
            // Restore the stack
            this.stack = stackBackup;

            // Place the rendered template in the final location
            node.parentNode.replaceChild(newnode, node);
            // Update the node in the closure to keep the correct reference
            node = newnode;

            // Try to avoid memory leaks
            newnode = null;
            cache.div.innerHTML = '';
        }, {ctx: this});
    }

    // Update dependencies
    if (bound && alldeps.length) {
        bound.depends(alldeps);
    }

    // check if we have to check the node's children
    if (recurse) {
        // iterate over all the children with care since the DOM structure could change
        var next, child = node.firstChild;
        while (child) {
            next = child.nextSibling;
            this.process( child );
            child = next;
        }
    }

    return node;
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
        throw new Error('Empty tales expression');
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
            if (result) break;
        } catch (e) {
            error = e;
        }
    }

    // throw an error if we couldn't find a valid result
    if (typeof result === 'undefined') {
        if (error) throw error;
        throw new Error('Tales expression "' + exps.join(' | ') + '" resolved to an undefined value');
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
    this.tpl = load(tpl);
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
DomTal.prototype.processor = function(name, priority, type, fn){
    if (arguments.length === 2) {
        fn = priority;
        priority = DomTal.PRIO.AVERAGE;
        type = DomTal.PROCTYPE.DEFAULT;
    } else if (arguments.length === 3) {
        fn = type;
        type = DomTal.PROCTYPE.DEFAULT;
    }

    // Remove any previous processor with the same name
    this.processors.removeByName(name);

    // Expand the callback function with additional meta data
    fn.procname = name;
    fn.proctype = type;

    this.processors.add(fn, priority);
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
//      <span tal:define="global myvar default"
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
        def = exp.ident() || exp.str('.');
        if (def === 'global') {
            data = this.stack[0];
            def = exp.ident() || exp.str('.');
        } else {
            data = this.stack[this.stack.length-1];
        }

        if (def === null) {
            throw new Error('Expected an identifier at ' + exp.pos + ' in "' + exp + '"');
        }

        // Not in the spec. but we allow an optional colon or equal sign
        exp.str(':');
        exp.str('=');

        // Now comes a tales expression
        tales = exp.tales();

        // If no expression was given we just use the node contents as value
        value = tales === null ? DomTal.DEFAULT : this.tales(tales);   

        // Move child nodes if we want to store them as defaults
        if (value === DomTal.DEFAULT) {
            value = document.createDocumentFragment();
            while (node.firstChild) {
                value.appendChild(node.firstChild);
            }
            // Process the child nodes in case they contain templating instructions
            this.process(value);
        } else if (value === DomTal.NOTHING) {
            continue;
        }

        // Check if we want to extract the properties of an object
        if (def === '.') {
            if (typeof value !== 'object') {
                throw new Error('Unable to extract variables from a non object resolved from expression "' + exp + '"');
            }

            for (var k in value) {
                if (value.hasOwnProperty(k)) {
                    data[k] = value[k];
                }
            }
        } else {
            data[def] = value;
        }

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
    if (tales !== null) {
        try {
            value = this.tales(tales);
        } catch (e) {
            // If there is an error evaluating the expression (ie: variable doesn't exists)
            // assume a false condition. This is not standard Tal but simplifies the common
            // use case of checking if a variable exists and is true.
            value = false;
        }
    }

    if (typeof value === 'function') {
        try {
            value = !!value();
        } catch(e) {
            value = false;
        }
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
//      </table>
//
DomTal.prototype.processor('repeat', DomTal.PRIO.HIGH, DomTal.PROCTYPE.REPLACE, function(node, exp){
    var data, meta, tales, item, value;

    // If we are in a loop then process its children only
    if (node.domtal_repeat) {
        delete node.domtal_repeat;
        return true;
    }

    // Parse the expression, an identifier followed by a tales expression
    exp = new ExpressionParser(exp);
    item = exp.ident();
    tales = exp.tales();

    value = this.tales(tales);

    // Get the current data bucket from the stack
    data = this.stack[ this.stack.length-1 ];
    if (typeof data.repeat === 'undefined') {
        data.repeat = {};
    }

    var i, len,
        values = [],
        fragment = document.createDocumentFragment(),
        tpl = node;

    // Preprocess the value to find how many items are there
    if (Object.prototype.toString.call(value) === '[object Array]') {
        len = value.length;
        for (i=0; i<len; i++) {
            values.push([i, value[i]]);
        }
    } else if ('each' in value && typeof value.each === 'function') {
        len = 0;
        value.each(function(v, k){
            values.push([k, v]);
            len++;
        });
    } else {
        len = 0;
        for (i in value) if (value.hasOwnProperty(i)) {
            values.push([i, value[i]]);
            len++;
        }
    }

    // Initialize the meta data object
    meta = data.repeat[item] = {
        index: 0,       number: 1,
        odd: false,     even: true,
        start: true,    end: len === 0,
        length: len
    };

    // Process the template for each one of the values
    for (i=0; i<len; i++) {
        meta.key = values[i][0];
        data[item] = values[i][1];

        node = tpl.cloneNode(true);
        node.domtal_repeat = true;
        fragment.appendChild(node);
        this.process(node);

        // update meta information
        meta.index++;           meta.number++;
        meta.odd = !meta.odd;   meta.even = !meta.even;
        meta.start = false;     meta.end = meta.number === len;
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

    if (isIE) {
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

        attr = exp.rex(/^\s*([a-z][a-z0-9_:-]*)/i);
        if (null === attr)
            throw new Error('Expected attribute name at ' + exp.pos + ' in "' + exp.exp + '"');

        // It's not in the spec but we optionally support a colon or equal as separator.
        exp.str(':');
        exp.str('=');

        tales = exp.tales();
        if (null === tales)
            throw new Error('Expected tales expression at ' + exp.pos + ' in "' + exp.exp + '"');

        // Work around IE bug (http://webbugtrack.blogspot.com/2007/11/bug-299-setattribute-checked-does-not.html)
        if (isIE && attr.toLowerCase() === 'checked') {
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
    value = tales ? this.tales(tales) : true;

    if (!value) {
        return true;
    }

    // Move the children to a fragment so we can replace this node with them
    value = document.createDocumentFragment();
    while (node.firstChild) {
        value.appendChild(node.firstChild);
    }

    // Process the child nodes
    this.process(value);

    return value;
});

// template
// --------
//  Applies the referenced template to the node replacing it. The template can be given by
//  a tales expression or directly using an document node Id prefixing it with the '#' char.
//
//  While this is not standard Tal it serves a common enough use case usually solved 
//  with Metal in compliant Tal implementations.
//
//      <span tal:define="tmpl" tal:template="tmpl">
//          This content is stored in 'tmpl' via tal:define and then used as 
//          the source of a template by tal:template. While this construct doesn't make
//          sense it serves to demo how to make tal processors working together.
//      </span>
//
//      <span tal:template="#my-template-id"></span>
//
DomTal.prototype.processor('template', DomTal.PRIO.AVERAGE, DomTal.PROCTYPE.REPLACE, function(node, exp){
    var tales, value;

    exp = new DomTal.ExpressionParser(exp);
    tales = exp.tales();
    if (tales && tales[0].charAt(0) === '#') {
        value = tales[0];
    } else {
        value = this.tales(tales);
    }

    if (!value) {
        throw new Error('Unable to obtain template to use from expression "' + exp + '"');
    }

    value = load(value);
    if (!value) {
        throw new Error('Unable to parse template defined by expression "' + exp + '"');
    }

    this.process(value);
    return value;
});

// css 
// ---
//  Applies the properties to the style of the node
//
//      <span tal:css="color: 'red', font-weight: cfg.font"></span>
//
DomTal.prototype.processor('css', DomTal.PRIO.AVERAGE, function(node, exp){
    var prop, tales;

    exp = new DomTal.ExpressionParser(exp);

    do {
        prop = exp.rex(/^\s*([\w-]+)/i);
        if (null === prop)
            throw new Error('Expected property name at ' + exp.pos + ' in "' + exp + '"');

        exp.str(':');

        tales = exp.tales();
        if (null === tales)
            throw new Error('Expected tales expression at ' + exp.pos + ' in "' + exp + '"');

        node.style[prop] = this.tales(tales);

    } while( exp.str(';') || exp.str(',') );
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
//      "page.title | page.alternativeTitle | 'No Title'"
//
//
// The _default_ keyword
// ---------------------
//  This allows template designers to keep the content of a tag as an
//  alternative value if an error occurs or if something is not defined. It
//  should be used as the last element of an _expression chain_.
//
//      <h1 tal:content="page.title | default">
//          This title will be shown if page/title is empty
//      </h1>
//
// Extending
// ---------
//  You can create your own modifiers by extending the DomTal.modifiers
//  object. The modifier functions take as only argument the tales expression
//  to evaluate.
// 
// -----------------------------------------------------------------------

DomTal.prototype.modifiers = {

    // path: _path.to.variable_ (Deprecated)
    // -----------------------
    //  > *Deprecated*. The default modifier is now to evaluate the expression as
    //    a Javascript statement.
    //
    //  We still support this modifier for historical reasons since it's the
    //  default one in most Tal implementations. It will convert the expression
    //  to a javascript statement replacing forward slashes '/' by dots '.'. 
    //
    //      <span tal:content="path: user.name" />
    //
    path: function DomTal_modifiers_path(exp) {
        return this.tales([ exp.replace(/\//g, '.') ]);
    },

    // exists: _tales_
    // ---------------
    //  This modifier returns true if the given tales expressions resolves to a
    //  valid value or false if it does not.
    //
    //      <span tal:condition="exists: user">
    //          Welcome ${user.name}
    //      </span>
    //
    exists: function DomTal_modifiers_exists( exp ) {
        try {
            this.tales([exp]);
            return true;
        } catch (e) {
            return false;
        }
    },

    // not: _tales_
    // ------------
    //  This modifier just negates the result of the given expression. It's
    //  specially useful when used in the _condition_ processor.
    //
    //      <span tal:condition="not: cart.items">
    //        There are no items in your cart
    //      </span>
    //
    not: function DomTal_modifiers_not( exp ) {
        return !this.tales([exp]);
    },

    // string: _string literal_ (deprecated)
    // ------------------------
    //  This prefix is no longer available.
    //
    string: function DomTal_modifiers_string( str ) {
        throw new Error('The "string:" prefix has been deprecated');
    },

    // js: _statement_
    // ---------------
    //  This modifier evaluates the expression as plain Javascript code after
    //  interpolating the expression for any variables.
    //
    //  Try to not abuse this modifier, the code is eval'd which could make its 
    //  debugging more difficult. If you need a special functionality try creating 
    //  a custom modifier, they are very easy to implement and should also be a bit 
    //  faster than eval'd code.
    //
    //  This will make a list with 10 items in it from 0 to 9
    // 
    //      <ul tal:repeat="elem [0,1,2,3,4,5,6,7,8,9]">
    //          <li tal:content="repeat.elem.index" />
    //      </ul>
    //
    //  This will do the same but the number of items is defined in a variable
    //
    //      <ul tal:repeat="elem new Array(path.to.numItems)">
    //          <li tal:content="repeat.elem.index" />
    //      </ul>
    //
    js: function(exp){
        var rex = /(['"\/\\\.])|([A-Za-z$_]+[A-Za-z0-9$_]*)/g,
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
                        backslash = dot = false;
                        return ch;
                    }
                } else if (ident) {

                    // TODO: Shall we manage how nested properties are obtained?
                    //   ie: `obj.foo`, if `obj` is undefined it will trigger an evaluation error

                    if (dot || quoted || -1 !== keywords.indexOf(ident)) {
                        backslash = dot = false;
                        return ident;
                    }

                    backslash = dot = false;
                    return "(THIS.get('" + ident + "', THIS.env['" + ident + "']))";
                }
            });
        }

        var fn, value;

        if (exp in cache.js) {
            fn = cache.js[exp];
        } else {
            // Optimize the simplest case which is just obtaining a top level variable
            if (/^[A-Za-z$_][A-Za-z0-9$_]*$/.test(exp) && -1 === keywords.indexOf(exp)) {
                return this.get(exp, this.env[exp]);
            }

            // Create a function instead of evaling the compiled code since Function is
            // safer and is supposed to be easier to optimize by Javascript engines.
            fn = cache.js[exp] = new Function('THIS', 'return (' + compile(exp) + ')');
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

    // structure: _tales_
    // ------------------
    //  Indicates that we want to use the contens without escaping especial characters.
    //  In standard Tal implementations `structure` is a keyword instead of a modifier.
    //
    structure: function DomTal_modifiers_structure(exp){
        var value;

        value = this.tales([exp]);

        if (typeof value === 'string') {
            return stringToDom(value);
        }

        return value;
    },

    // h: _tales_
    // -----------
    //  Just an alias to the structure modifier
    //
    h: function DomTal_modifiers_html(exp){
        return this.modifiers.structure.call(this, exp);
    },

    // u: _tales_
    // ----------
    //  Encodes the given expression value using the encodeURI() function
    //
    u: function DomTal_modifiers_u(exp){
        var value;
        value = this.tales([exp]);
        return encodeURI(value);
    },

    // uc: _tales_
    // -----------
    //  Encodes the given expression value using the encodeURIComponent() function
    //
    uc: function DomTal_modifiers_uc(exp){
        var value;
        value = this.tales([exp]);
        return encodeURIComponent(exp);
    },

    // bool: _tales_
    // -------------
    //  This modifier casts the expression value to a boolean. It understands strings
    //  with Yes/No, On/Off and True/False. A string of '0' is casted to false.
    //
    //      <input type="checkbox" tal:attributes="checked bool:user.active" />
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

    // int: _tales_
    // ------------
    //  This modifier casts the expression value to an integer
    //
    //      <span>${int:user.age}</span>
    // 
    'int': function DomTal_modifiers_int(exp){
        var value;

        value = this.tales([exp]);
        value = parseInt(value, 10);

        return isNaN(value) ? 0 : value;
    },

    // float: _tales_
    // --------------
    //  This modifier casts the expression value to a float 
    // 
    //      <span>${float:item.ratio}</span></span>
    //
    'float': function DomTal_modifiers_float(exp){
        var value;

        value = this.tales([exp]);
        value = parseFloat(value);

        return isNaN(value) ? 0.0 : value;
    },

    // tpl: [ _#id_ | _tales_ ]
    // ------------------------
    //  Parse the given template returning the result. It uses the same logic as the `template`
    //  processor however this modifier allows to use nested templates with common tal processors 
    //  like `replace` or `content`.
    //
    //      <br tal:replace="tpl: #my-template" />
    //
    tpl: function DomTal_modifiers_tpl(exp){
        var value;

        value = exp.replace(/^\s+/,'').replace(/\s+$/,'');

        if (value.charAt(0) !== '#') {
            value = this.tales([value]);
        }

        if (!value) {
            throw new Error('Unable to determine template from expression "' + exp + '"');
        }

        value = load(value);
        if (!value) {
            throw new Error('Unable to parse template from expression "' + exp + '"');
        }

        // Process the template nodes
        this.process(value);

        return value;
    }
};


// Exports
// =======

exports.DomTal = DomTal;
exports.DomTal.ExpressionParser = ExpressionParser;


})(typeof exports !== 'undefined' ? exports : window);
