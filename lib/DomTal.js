/*
Script: DomTal.js

    DomTal 1.1 - A TAL template parser for javascript.

License:
    MIT style license

    See bundled LICENSE file or check <http://www.opensource.org/licenses/mit-license.php>

Copyright:
    copyright (c) 2005-2011 Iván -DrSlump- Montes <http://pollinimini.net>

Credits:
    - The script is based on work from Joachim Zobel <http://heute-morgen.de> (used with permission)
    - The API and template syntax follows the one from PHPTAL <http://phptal.motion-twin.com>


Notes: Known issues

    - This script uses the own browser to parse the html, so you must be
    carefull with the validity of the code. A common mistake is to use the short
    syntax '<tag />' for elements which shouldn't according to the standard.
    It's always a good idea to use always the full syntax (except for <br/> and
    <hr/>) even when no content is defined.

    - In Internet Explorer the tal attributes (processors) can't be removed from
    the generated code although this shouldn't affect anything.


Notes: Differences with PHPTAL

    - Does not support the _tal:block_ element
    - Does not support the _tal:on-error_ processor
    - Does not support _Metal_, however a similar behaviour can be mimicked with
    document fragments and common tal processors
    - _omit-tag_ works a bit differently from PHPTAL. If the tales expression
    evaluates to true the tag is removed and its contents shown, otherwise the
    tag is also shown.
    This is an intended change and can be easily removed by creating a custom
    wrapper for this processor.


Notes: TODO

    - Check for performance bottlenecks and memory leaks

-----------------------------------------------------------------------------

Section: Usage

    First we need to have a template somewhere in the page. Be it as an html
    string, a containing element or a document fragment.

    (start code)
    @xml
    <div id="myTemplate" style="display: none">
        <table>
        <tr>
            <th>Username</th>
            <th>E-Mail</th>
        </tr>
        <tr tal:repeat="user users"
            tal:attributes="class js:${repeat/user/odd}?'odd':'even'">
            <td tal:content="user/name"></td>
            <td>${user/email}</td>
        </tr>
        </table>
    </div>
    (end)

    we could also use an html string, either as a javascript string literal or
    by using the script tag

    (start code)
    @xml
    <script type="template/domtal" id="myTemplate"><![CDATA[
        <table>
        <tr>
            <th>Username</th>
            <th>E-Mail</th>
        </tr>
        <tr tal:repeat="user users"
            tal:attributes="class js:${repeat/user/odd}?'odd':'even'">
            <td tal:content="user/name"></td>
            <td>${user/email}</td>
        </tr>
        </table>
    ]]></script>
    (end)

    next we need to create the template object and set the apropiate data. Note
    that we can create the data set anyway we want, even loading it with JSON or
    similar remoting methods.

    (start code)
    @javascript
    var tpl = new DomTal();
    tpl->set( 'users', [{
        name: 'Joe Black',
        email: 'jblack@yahoo.co.uk'
    }, {
        name: 'Mike Flowers',
        email: 'mike.flowers@aol.es'
    }]);
    (end)

    now we just need to assign our template to the parser, process it and get
    the result

    (start code)
    @javascript
    tpl.load( document.getElementById('myTemplate') );
    var out = tpl.run();
    // put the result on the page
    document.getElmentById('outUsers').appendChild( out );
    (end)

    And that's it. There a few more options but overall it's a pretty easy to
    use library.


Section: Customization

Topic: Creating a new processor

    To extend the available processors we only need to create (or redefine) a
    method in *DomTal.processors*. Be aware that the order in which the
    processor methods are defined in the code specify their priority. The
    standard ones are applied in this order:
        _define_, _condition_, _repeat_, _content_, _replace_, _attributes_, _omit-tag_

    The return value of a processor has meaning. If it returns _true_ then the
    children elements of that node will be further processed, alternatively, if
    it returns _false_ its children will be skipped.

    We are going to create a new processor which will convert an array items to
    a set of LI elements. It'll apply a class named 'selected' to the LI whose
    key is equal to the second tales expression:
    (start code)
    @xml
    <ul tal:li="path/to/array selectedKey" />
    (end)

    The processor implementation:
    (start code)
    @javascript
    DomTal.prototype.processors.li = function ( node, exp ) {

        // remove current childs if any
        while ( node.firstChild )  {
            node.parentNode.removeChild( node.firstChild );
        }

        // split the expression by spaces
        exp = this.split( exp, ' ' );

        // get the key if pressent
        var key = (exp.length>1) ? exp.pop() : '';

        // merge again the expression once we got the key
        exp = exp.join(' ');

        // get the variable
        var arr = this.makeIterable( this.tales( exp ) );
        if ( arr.count ) {
            for (var i=0; i<arr.count; i++) {
                var li = document.createElement('LI');
                // check if this is the selected item
                if ( arr.keys[i] == key )
                    li.setAttribute('class', 'selected');
                // append the item value to the list element
                li.appendChild( document.createTextNode( arr.values[i] ) );
                // append the list element to the list container
                node.appendChild( li );
            }
        }

        // since we don't want to process the new child elements we return false
        return false;
    }
    (end)

    The following expression with a data set of ['one', 'two', 'three']
    (start code)
    @xml
    <ul id="list" tal:li="data 1">
        <li>Test item</li>
    </ul>
    (end)

    will generate the following html
    (start code)
    @xml
    <ul id="list">
        <li>one</li>
        <li class="selected">two</li>
        <li>three</li>
    </ul>
    (end)


Topic: Creating a new tales modifier

    We can also add our own _Tales_ modifiers by extending the *DomTal.modifiers*
    object with new methods. The methods just take an argument with the
    expression to evaluate and should return the result of that argument.

    In this example we are going to create a modifier which will _implode_ an
    array separating its items with the given separator.

    (start code)
    @javascript
    DomTal.prototype.modifiers.implode = function( exp ) {
        var sep, result;
        exp = this.split( exp, ' ' );
        if (exp.length > 1) {
            sep = exp.shift();
            result = this.makeIterable( this.tales(exp.join(' ')) );
            return result['values'].join( this.tales(sep) );
        }
    }
    (end)

    (start code)
    @xml
    <span tal:content="implode: ', ' js:['one','two','three']"></span>
    (end)

    will produce
    (start code)
    @xml
    <span>one, two, three</span>
    (end)
*/


/****************************************************************************
Class: DomTal 
    The TAL template parser class

Arguments:
    tpl   - Optional, the template to load
    data  - Optional, the initial global variables to be used in the template
    ns    - Optional, the attributes namespace used in the template (by default is 'tal')

Example:
    (start code)
    var tpl = new DomTal( '#mytpl', { test: 'A test variable' }, 'tal' );
    (end)
*/
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
    this.defMod = this.modifiers.path;
}

// Constants
DomTal.NOTHING = '([*>-NOTHING-<*])';
DomTal.DEFAULT = '([*>-DEFAULT-<*])';

//
// Create some static caches to be shared among all instances
//
DomTal._div = document.createElement('DIV');
DomTal._separators = {};


/*
Property: getByPath
    Fetchs the contents of the variable defined by its path. The local variables
    have priority. If the variable is not found it returns _undefined_.

Arguments:
    path - the path to the desired variable

Notes:
    - you can use either the forward slash '/' or a dot '.' to build the path
    - you should consider this method as _private_
*/
DomTal.prototype.getByPath = function( path ) {
    var i, j,
        result;

    path = path.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    path = path.split(/[\/\.]/);

    // search in each data bucket starting from the top of the stack to its root
    i = this.stack.length;
    while (i--) {
        result = this.stack[i];
        // try to traverse the data structure according to the path
        for (j=0; result && j<path.length; j++) {
            result = result[path[j]];
        }
        // if path found then return it, otherwise lets check the next data bucket
        if (typeof result !== 'undefined') {
            return result;
        }
    }

    this.log('Can not find a variable by this path: "' + path.join('/') + '"');
    return result;
};

/*
Property: interpolate
    Interpolates the given text with the current set of variables.

Arguments:
    txt - the text to interpolate

Notes:
    - you should consider this method as _private_
*/
DomTal.prototype.interpolate = function( txt ) {
    // copy the object scope var as local variable to be used in the regexp closure
    var me = this;

    // we capture the char just before so we can skip escaped marks. ie: $${..}
    return txt.replace(/(^|[^\$])\$\{([^\}]+)\}/gmi, function(str, prefix, path) {
            var v = me.tales(path);
            if (typeof v === 'undefined') {
                return prefix;
            } else if (typeof v === 'object') { // Dom
                var div = DomTal._div;
                div.innerHTML = '';
                div.appendChild(v.cloneNode(true));
                v = div.innerHTML;
            }

            return prefix + v;
    });
};

/*
Property: stringToDom
    Converts the given html text to a DOM Fragment

Arguments:
    html - A string containing html code

Notes:
    - you should consider this method as _private_

Example:
    (start code)
    @javascript
    var html = 'This is an <em>html</em> string';
    var fragment = tpl.stringToDom( html );
    (end)
*/
DomTal.prototype.stringToDom = function( html ) {
    var div, fragment;

    // let the browser parse the HTML string
    div = DomTal._div;
    div.innerHTML = html;

    // create a document fragment and copy in it the parsed elements
    fragment = document.createDocumentFragment();
    while (div.firstChild) {
        fragment.appendChild( div.firstChild );
    }

    return fragment;
};

/*
Property: makeIterable
    Returns an structure suited to be iterable from the supplied argument. This
    method is used by the _repeat_ processor.

Arguments:
    res - A variable to be converted to an iterable structure

Returns:
    An iterable structure which looks like this

    (start code)
    @javascript
    {
        'keys': [],   // the item keys as an array
        'values': [], // the item values as an array
        'count' : 0  // the number of items
    }
    (end)

Notes:
    - you should consider this method as _private_
    - If you need to handle some special objects you can extend this method to
    handle them, see the following example:
        (start code)
        @javascript
        // Create a new object
        function MyDOMTAL() {};
        // Relate the new object to DomTal by prototype inheritance
        MyDOMTAL.prototype = new DomTal();
        // Extend the makeIterable method
        MyDOMTAL.prototype.makeIterable = function( v ) {
            if ( typeof v === 'object' && v.type === 'yourCustomObject') {
                // Create an iterable structure for your custom object
                YOUR CUSTOM CODE GOES HERE
            } else {
                // Just call the default method for native types
                return DomTal.prototype.makeIterable.call(this, v)
            }
        }
        (end)

Example:
    (start code)
    @javascript
    var obj = {
        'a': 'AAA', 'b': 'BBB'
    };
    var iter = tpl.makeIterable(obj);
    for (var i=0; i<iter.count; i++)
        alert( 'Key: ' + iter.keys[i] + ' Value: ' + iter.values[i]);
    (end)
*/
DomTal.prototype.makeIterable = function( res ) {
    var i, k,
        data = {
            'keys'  : [],
            'values': [],
            'count' : 0
        };

    if ( res instanceof Array ) {
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

/*
Property: split
    Splits the given expression by the choosen char preserving single quoted
    strings, double char escapes and trimming each result.

Arguments:
    exp - The expression to split
    sep - The separator char

Example:
    (start code)
    @javascript
    tpl.split( 'one;; two;; three; 1;2', ';');
    // returns [ one;; two;; three, 1, 2 ]
    tpl.split( "  'one two three' 1 2", ' ');
    // returns [ one two three, 1, 2 ]
    (end)
*/
DomTal.prototype.split = function (exp, sep) {
    var result, pos, re, res;

    // trim the expression
    exp = exp.replace(/^\s\s*/, '').replace(/\s\s*$/, '');


    // check if this separator has been already computed and cached
    if ( !DomTal._separators[sep] ) {

        DomTal._separators[sep] = {};

        // In the next conditionals we build two regular expressions, 'escaped'
        // is used to find escaped separators (the separator token twice) and
        // 'separator' is a regular expression which matches the separator

        // split by spaces
        if (sep === ' ') {
            DomTal._separators[sep] = {
                escaped  : /$0/gm, // an imposible match since spaces cannot be escaped
                separator: /\s+/gm
            };
        // escape the separator if it's a special char
        //} else if (sep.match(/[^A-Za-z0-9]/)) {
        } else if (sep.match(/[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]/)) {
            DomTal._separators[sep] = {
                escaped  : new RegExp('\\' + sep + '\\' + sep, 'gm'),
                separator: new RegExp('\\s*\\' + sep + '\\s*', 'gm')
            };
        // handle plain chars
        } else {
            DomTal._separators[sep] = {
                escaped  : new RegExp(sep + sep, 'gm'),
                separator: new RegExp('\\s*' + sep + '\\s*', 'gm')
            };
        }
    }

    // use the cached copy
    res = DomTal._separators[sep];

    // Process all the single quoted strings
    result = '';
    re = /'(''|[^'])*'/gm;
    re.lastIndex = pos = 0;
    while ((m = re.exec(exp))) {
        // process the text before the first quote
        if (pos < re.lastIndex - m[0].length) {
            result += exp.substring( pos, re.lastIndex-m[0].length ).
                replace( res.escaped, '#ESCAPED#' ).
                replace( res.separator, '#SEPARATOR#' );
        }

        // add the text between quotes as is
        result += m[0];
        pos = re.lastIndex;
    }

    // Process the remaining text
    if (pos < exp.length) {
        result += exp.substring( pos ).
                replace( res.escaped, '#ESCAPED#' ).
                replace( res.separator, '#SEPARATOR#' );
    }

    // Now just replace the placeholders for escaped chars and split by the markers
    return result.
        replace('#ESCAPED#', sep).
        split('#SEPARATOR#');
};

/*
Property: get
    Fetchs the contents of a global variable defined by its path. If the
    variable is not found it returns _undefined_.

Arguments:
    path - the path to the desired variable

Notes:
    - you can use either the forward slash '/' or a dot '.' to build the path

Examples:
    (start code)
    @javascript
    var v = tpl.get( 'path/to/variable' );
    (end)
*/
DomTal.prototype.get = function( path ) {
    var d, i;

    path = path.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    path = path.split(/[\/\.]/);

    // get the root data bucket and search the path in it
    d = this.stack[0];
    for (i=0; i<path.length; i++) {
        if (typeof d === 'undefined') return;
        d = d[path[i]];
    }
    return d;
};

/*
Property: set
    Sets the contents of a variable defined by its path. Returns false if the
    path is not valid.

Arguments:
    path - the path to the desired variable
    data - the value to assign to that variable

Notes:
    - you can use either the forward slash '/' or a dot '.' to build the path

Examples:
    (start code)
    @javascript
    // Set the name for the 3rd user
    tpl.set( 'user/3/name', 'Joe' );

    // Set a whole user
    tpl.set( 'user.4', { name: 'Mike', age: 22, email: 'mike@foo.bar' } );

    // Add a bunch of new _global_ variables
    tpl.set( '/', { name: 'Ivan', age: 27, email: 'ivan@domain.com' } );
    tpl.set( { name: 'Ivan', age: 27, email: 'ivan@domain.com' } );

    // Merge some variables into another variable
    tpl.set( 'user.3/', { name: 'Gerard', age: 23, email: 'gerard@nospam.com' } );

    (end)
*/
DomTal.prototype.set = function( path, data ) {
    var d, i, last;

    // Handle the case where only the data is given as argument
    if (arguments.length === 1) {
        data = path;
        path = '';
    }

    path = path.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    path = path.split(/[\/\.]/);
    last = path.pop();

    d = this.stack[0];
    for (i=0; i<path.length; i++) {
        if ( typeof d[path[i]] === 'undefined' ) {
            d[ path[i] ] = {};
        }

        d = d[ path[i] ];

        // if we are trying to extend a non extendable type return error
        if ( d === null || typeof d === 'boolean' ||
            typeof d === 'number' || typeof d === 'string' ) {
            this.log('Error setting "' + path.join('/') + '/' + last +
                '", trying to extend a non extendable type'
            );
            return false;
        }
    }

    // check if we want to merge instead of adding a new variable
    if (!last) {
        if ( !data || typeof data === 'boolean' ||
            typeof data === 'number' || typeof data === 'string' ) {
            this.log('Error setting "' + path.join('/') + '/' +
                '", trying to merge against a non extendable type'
            );
            return false;
        }

        for (i in data) {
            if ( !data.prototype || typeof data.prototype[i] === 'undefined' ) {
                d[i] = data[i];
            }
        }
    } else {
        d[last] = data;
    }

    return true;
};

/*
Property: log
    Reports an error or warning while parsing a template. Replace it with your
    own function to access the messages, by default nothing is done with them.

Arguments:
    msg - the error message
*/
DomTal.prototype.log = function( msg ) {
    // do nothing by default
};

/*
Property: process
    Parses the given node element modifying it according to the template
    instructions.

Arguments:
    node - the template as a DOM fragment, a containing element or a string

Note:
    The root element passed shouldn't contain any processor since many
    processors rely on the _parentNode_ to operate. Always use a Document
    Fragment or a containing element such as a simple DIV.

Example:
    (start code)
    @javascript
    tpl.process( myTemplateElement );
    document.getElementById('holder').appendChild( myTemplateElement );
    (end)
*/
DomTal.prototype.process = function( node ) {
    var next, child,
        attrsNo,
        anode,
        p,
        recurse = true;

    // Create a new local data set for new scope
    this.stack.push({});

    // text node
    if (node.nodeType === 3) {

        // interpolate any variable pressent in the raw text
        node.nodeValue = this.interpolate( node.nodeValue );
        // text nodes do not have child elements
        recurse = false;

    // element inside a container and with at least one attribute
    } else if (node.nodeType === 1 && node.parentNode && (attrsNo = node.attributes.length)) {

        // check each processor to see if it's defined in the node
        for (p in this.processors) if (this.processors.hasOwnProperty(p)) {
            if ( (anode = node.getAttributeNode(this.ns + p)) ) {

                // Run the processor against the current node
                recurse = this.processors[p].call(this, node, anode.value);

                // if the processor has removed the node then just exit
                if (!node || !node.parentNode) {
                    recurse = false;
                    break;
                }

                // find if the attribute is still there
                anode = node.getAttributeNode(this.ns + p);
                // if the attribute is still there and not IE then remove it
                if ( /*@cc_on!@*/true && anode ) {
                    node.removeAttributeNode( anode );
                }

                // if no more attributes then we can stop looking for processors
                if ( --attrsNo < 1 ) {
                    break;
                }
            }
        }

        // Check remaining attributes to perform interpolation
        attrsNo = node.attributes.length;
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

    // remove the current local data set since it has run out of scope
    this.stack.pop();
};


/*
Property: tales
    Evaluates the given Tales expression returning the result.

Arguments:
    str - the tales expression to evaluate

Note:
    If the _default_ keyword is found then the string DomTal.DEFAULT is returned
    If the _nothing_ keyword is found then the string DomTal.NOTHING is returned

Example:
    (start code)
    @javascript
    var result = tpl.tales( 'path/to/variable' );
    (end)
*/
DomTal.prototype.tales = function( str ) {
    var prefix,
        m,
        pos,
        chained = false,
        result,
        lastIndex,
        re = /'((?:''|[^']+)*)'|(\|)|(([A-Za-z-]+)\s*:\s*(\|\||[^\|]*))/gm;
        // 1 : Single quoted string (ie: 'my ''quoted'' string')
        // 2 : Pipe (ie: |)
        // 3 : modifier (ie: js:2+2)
        // 4 : modifier prefix
        // 5 : modifier value

    if ( !str ) {
        return '';
    }

    pos = 0;
    re.lastIndex = 0;
    while ( (m=re.exec(str)) ) {
        // If there is some unmatched text just before process it with the default modifier
        if (pos < re.lastIndex - m[0].length) {
            result = this.defMod.call( this, str.substring(pos, re.lastIndex-m[0].length) );
        }

        // Javascript uses a single regexp object for each window, when defining a
        // regexp literal it's compiled to optimize its use, however since we can
        // call this function recursively, by calling it from a tales modifier
        // called from here. This could potentionally create an infinit loop since
        // we are modifing the RegExp.lastIndex on each call. So we store the
        // current lastIndex and restore it after we have called the modifier
        lastIndex = re.lastIndex;

        // If no result is yet computed keep evaluating the expression
        if (!result) {
            // Quoted string
            if (m[1] && m[1].length) {
                // Undo repeated quotes escapes
                m[1] = m[1].replace( /''/g, '\'' );
                result = this.modifiers.string.call( this, m[1] );

            // A pipe (|) was found so flag this expression as chained
            } else if (m[2] && m[2].length) {

                chained = true;

            // Modifier syntax
            } else if (m[3] && m[3].length) {

                if (this.modifiers[m[4]]) {
                    m[5] = m[5].replace( /\|\|/, '|' );
                    result = this.modifiers[m[4]].call( this, m[5] );
                } else {
                    this.log( 'Undefined tales modifier "' + m[4] + '"' );
                }
            }
        }

        // If we finally have a result just use it
        if (result) {
            return result;
        }

        // restore the RegExp.lastIndex property for a new iteration
        re.lastIndex = pos = lastIndex;
    }

    // Process the remaining of the expression
    if (pos < str.length) {
        result = str.substring(pos);
        if (chained && result.match(/^\s*default\s*/i)) {
            result = DomTal.DEFAULT;
        } else if (chained && result.match(/^\s*nothing\s*$/i)) {
            result = DomTal.NOTHING;
        } else {
            result = this.defMod.call( this, result );
        }
    }

    return result;
};

/*
Property: load
    Prepares the given template to be used.

Arguments:
    tpl - the template to use as a string, a script node with the contents
            inside, a node with the template as childs or a document fragment

Returns:
    A document fragment based on the supplied template or false if the template
    was not valid.

Note:
    If the given template is not a document fragment the function will try to
    convert it to one. This can take some time so if you're repeatedly setting
    the same template you should cache the result of this function after the
    first call and use that cached result in the following calls.

Example:
    (start code)
    @javascript
    tpl.load( document.getElementById('myTemplate') );
    (end)
*/
DomTal.prototype.load = function( tpl ) {
    var i;

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


/*
Property: run
    Parses the template and returns the final result.

Arguments:
    data  - optional argument with data to use with the template. You can also use
            DomTal.set for that.

Returns:
    a document fragment with the result of the template or false if an error
    happened

Example:
    (start code)
    @javascript
    tpl.load( document.getElementById('myTemplate') );
    var out = tpl.run({foo:'Foo', bar:'Bar'});
    document.body.appendChild(out);
    (end)
*/
DomTal.prototype.run = function(data) {
    var result;

    if (data) {
        this.set(data);
    }

    if (!this.tpl) {
        this.log('No template was loaded, unable to perform the action');
        return false;
    }

    // Make a copy of the template and process it
    result = this.tpl.cloneNode(true);
    this.process(result);

    return result;
};


/**************************************************************************
Section: TAL Processors

Note:
    - Here are implemented the standard set of TAL processors. The order in
    which they are defined is important so do not refactor it.
    - The functions are called with the <DomTal> object in the _this_ variable
    so you can use the methods from <DomTal>.

The functions take two arguments:
    - the first argument is the document element node in which that processor is
    defined
    - the second argument is the tales expression to parse
*/

DomTal.prototype.processors = {

    /*
    Processor: define
        Defines one or more variables which may be used later in the template.
        To separate the variable definitions use a semi-colon. To declare a
        global variable use the _global_ prefix, otherwise the variable will be
        declared as local and will only be available to the current node and
        its children.

        (start code)
        define="[global] VarName [TalesExpression|structure]"
        (end)

    Notes:
        - Empty elements with this processor are not removed from the template,
        use _omit-tag_ to accomplish that behaviour.
        - If no tales expression is supplied or it's _structure_ then the
        contents of the tag are assigned to the variable, in that case it'll be
        added as a document fragment not as a string.

    Examples:
        Making a global shortcut to a long path
        (start code)
        @xml
        <span tal:define="global destname path/to/existing/variable" />
        (end)

        Assigning the contents of an element to a variable
        (start code)
        @xml
        <span tal:define="global myvar structure"
            tal:omit-tag="1">
            This is a <strong>string</strong>
        </span>
        (end)

        Defining a local variable
        (start code)
        @xml
        <span tal:define="myLocalVar js:new Array(10)"
            tal:repeat="item myLocalVar" tal:content="item">
        </span>
        (end)
    */
    define: function DomTal_processors_define( node, exp ) {

        var m,
            data,
            d,
            def,
            defs;

        // Split the expression by semi-colons
        defs = this.split(exp, ';');

        while ( (def = defs.shift()) ) {
            // convert to array splitting at spaces
            def = this.split(def, ' ');

            data = this.stack[ this.stack.length-1 ];

            // get first token
            d = def.shift();
            if ( d === 'global' ) {
                data = this.stack[0];
                d = def.shift();
            }

            if (def.length) {
                def = def.join(' ');
                if (def !== 'structure') {
                    data[d] = this.tales(def);
                    continue;
                }
            }

            if (data !== this.stack[0]) {
                this.log('Defining local variable "' + d + '" from content has no effect.');
                continue;
            }

            // capture the contents and assign them to the variable
            data[d] = document.createDocumentFragment();
            // move all the children, once processed, outside the tag
            while (node.firstChild) {
                this.process( node.firstChild );
                if ( node.firstChild ) {
                    data[d].appendChild( node.firstChild );
                }
            }
        }

        // process the children nodes
        return true;
    },

    /*
    Processor: condition
        The entity and its contents will be shown only if the expression
        evaluates to true.

        (start code)
        condition="TalesExpression"
        (end)

    Examples:
        The preferable way is to use boolean like variables
        (start code)
        @xml
        <span tal:condition="cart/isEmpty">
            No items in your cart
        </span>
        (end)

        We can also use javascript code for special conditions
        (start code)
        @xml
        <span tal:condition="js: ${cart/items}.length < 1">
            No items in your cart
        </span>
        (end)
    */
    condition: function DomTal_processors_condition( node, exp ) {

        if ( !this.tales( exp ) ) {
            node.parentNode.removeChild(node);
            return false;
        }

        return true;
    },

    /*
    Processor: repeat
        This processor handles iterable data like arrays and objects. The repeat
        attribute repeats its element and its content until the end of the
        specified resource.

        (start code)
        repeat="item TalesExpression"
        (end)

        Within a loop, you can access the current loop information (and that of
        its parent for nested loops) using specific repeat/ paths. In the
        following table _item_ is the name of the receiver variable used in the
        repeat processor.

            repeat/item/index   - returns the item index (0 to count-1)
            repeat/item/number  - returns the item number (1 to count)
            repeat/item/even    - returns true if the item index is even
            repeat/item/odd     - returns true if the item index is odd
            repeat/item/start   - returns true if the item is the first one
            repeat/item/end     - returns true if the item is the last one
            repeat/item/length  - returns the number of elements in the resource
            repeat/item/key     - returns the item's key

    Examples:
        One common use of this processor is to populate a table with data
        (start code)
        @xml
        <table>
            <thead>
                <tr>
                    <th>Position</th>
                    <th>Player</th>
                    <th>Score</th>
                </tr>
            </thead>
            <tbody>
                <tr tal:repeat="ranking playersRanking">
                    <td tal:content="repeat/ranking/index"/>
                    <td tal:content="ranking/player"/>
                    <td tal:content="ranking/score"/>
                </tr>
            </tbody>
        </table>
        (end)
    */
    repeat: function DomTal_processors_repeat( node, exp ) {
        var data, meta, item, local, newNode;

        // if we are in a loop then process its children normally
        if (node.getAttribute('domtal_repeat')) {
            node.removeAttribute('domtal_repeat');
            return true;
        }

        // mark the node as a repeated item template
        node.setAttribute('domtal_repeat', 'true');

        // split by spaces
        exp = this.split(exp, ' ');
        item = exp.shift();
        exp = exp.join(' ');

        local = this.makeIterable( this.tales( exp ) );

        data = this.stack[ this.stack.length-1 ];
        if ( typeof data.repeat === 'undefined' ) {
            data.repeat = {};
        }

        // Initialize the meta data object
        meta = data.repeat[item] = {};

        // Loop over all the data set
        for (var i=0, len=local.count; i<len; i++) {
            // Update the meta information
            meta.index = i;
            meta.number = i+1;
            meta.odd = !(i%2);
            meta.even = !meta.odd;
            meta.start = i === 0;
            meta.end = i === len-1;
            meta.length = len;
            meta.key = local.keys[i];

            data[item] = local.values[i];

            // Clone the template node and include it as a sibling
            newNode = node.cloneNode(true);
            node.parentNode.insertBefore( newNode, node );

            // Process the template
            this.process( newNode );
        }

        // Remove the template
        node.parentNode.removeChild( node );

        return false;
    },

    /*
    Processor: content
        This processor replaces the tag content with the result of its
        expression.

        (start code)
        content="TalesExpression"
        (end)

    Examples:
        (start code)
        @xml
        <span tal:content="myvar">
            This text will be replaced by the contents of myvar
        </span>
        (end)
    */
    content: function DomTal_processors_content( node, exp ) {

        var content = this.tales( exp );

        if (content === DomTal.DEFAULT) {
            return true;
        }

        // remove the current content
        while ( node.firstChild ) {
            node.removeChild( node.firstChild );
        }

        // check if we want to include a DOM Node
        if (content && content.nodeType) {
            node.appendChild( content );
            return true;
        } else if (content !== DomTal.NOTHING) {
            node.appendChild( document.createTextNode(content) );
            return false;
        }

        // do not process children nodes
        return false;
    },

    /*
    Processor: replace
        This processor will replace the entire tag (and its children) with the
        result of its expression or remove it completely if the expression
        returns no value.

        (start code)
        replace="TalesExpression"
        (end)

    Examples:
        (start code)
        @xml
        <span tal:replace="myvar">
            This text will be replaced by the contents of myvar
            and without the span tag around it
        </span>
        (end)
    */
    replace: function DomTal_processors_replace( node, exp ) {

        var content = this.tales( exp );
        if (typeof content === 'undefined') {
            content = '';
        }

        if (content === DomTal.DEFAULT) {
            return true;
        }

        // check if we want to include a DOM Node or fragment
        if (content && content.nodeType) {
            node.parentNode.replaceChild( content, node );
        } else if (content === DomTal.NOTHING) {
            node.parentNode.removeChild(node);
            return false;
        } else {
            node.parentNode.replaceChild( document.createTextNode(content), node );
        }

        return true;
    },

    /*
    Processor: attributes
        This processor changes the tag attributes with the defined values.

        (start code)
        attributes"TalesExpression [; TalesExpression]"
        (end)

    Note:
        As we use a semi-colon as separator, to use a semi-colon as part of a
        expression we must prefix it with another one ';;' to escape it.

    Examples:
        (start code)
        @xml
        <a href="http://www.foo.com"
            tal:attributes="href link/url; style 'color:red;; background: yellow'"
            tal:content="link/name"
        >
            This text will be replaced by the contents of link/name
        </a>
        (end)
    */
    attributes: function DomTal_processors_attributes( node, exp ) {
        var attr, name, value,
            attrs = this.split( exp, ';' );

        while ( (attr = attrs.shift()) ) {
            // convert to array splitting at spaces
            attr = this.split( attr, ' ' );
            // use the first token as attribute name and join the other tokens as data
            name = attr.shift();
            value = this.tales(attr.join(' '));
            if (value === true) {
                node.setAttribute(name, name);
            } else if (value === false || value === DomTal.NOTHING) {
                node.removeAttribute(name);
            } else if (value !== DomTal.DEFAULT) {
                node.setAttribute(name, value);
            }
        }

        return true;
    },


    /*
    Processor: omit-tag
        This processor makes the parser skip its tag if there is no expression or if
        it evaluates to true. The contents of the tag will however be parsed and included
        in the output.

        (start code)
        omit-tag="TalesExpression"
        (end)

    Note:
        Unlike PHPTAL, this processor requires its expression to evaluate to
        true, although passing it an empty expression will also trigger its 
        behaviour.

    Examples:
        (start code)
        @xml
        <span tal:omit-tag="myvar">
            If myvar evaluates to true this text will appear without the span tag
            surrounding it
        </span>
        (end)
    */
    'omit-tag': function DomTal_Processors_omittag( node, exp ) {

        // if we have already processed this tag then just exit
        if (node.getAttribute('domtal_omit-tag')) {
            node.removeAttribute('domtal_omit-tag');
            return true;
        }

        if ( !exp.length || this.tales( exp ) ) {
            // process the node again to format the children
            node.setAttribute('domtal_omit-tag', 'true');
            this.process( node );

            // move children outside this node
            while ( node.firstChild ) {
                node.parentNode.insertBefore( node.firstChild, node );
            }

            // remove the tag once everything is outside it
            node.parentNode.removeChild( node );
        }

        return false;
    }

};


/**************************************************************************
Section: TALES modifiers

Expression chains:

    An expression chain is a list of expressions separated by the '|' character.
    While evaluating those expressions, DOM TAL will stop its evaluation when an
    expression value is not null and no error was raised.

    (start code)
    "page/title | page/alternativeTitle | 'No Title'"
    (end)

The _default_ keyword:

    This allows template designers to keep the content of a tag as an
    alternative value if an error occurs or if something is not defined. It
    should be used as the last element of an _expression chain_.

    (start code)
    @xml
    <h1 tal:content="page/title | default">
        This title will be shown if page/title is empty
    </h1>
    (end)

The _structure_ keyword:

    This keyword can be used as a prefix for a variable to indicate that we want
    to include its content as a _document fragment_ instead of a string.

    This will insert inside the div the HTML elements defined in 'myvar' instead
    of inserting the variable as a string which is the default behaviour.
    (start code)
    @xml
    <div tal:content="structure myVar" />
    (end)

Extending:
    - You can create your own modifiers by extending the DomTal.modifiers
    object. The modifier functions take as only argument the tales expression
    to evaluate.
*/

DomTal.prototype.modifiers = {

    /*
    Modifier: path
        This is the default modifier, it evaluates the given expression as a
        variable path. Aditionally you can also use numbers (integers and
        floats) and the boolean keywords _true_ and _false_.

        (start code)
        "path/to/var"
        "path: path/to/var"
        (end)

    Examples:
        (start code)
        @xml
        <span tal:content="user/name" />
        <span tal:content="path: user/email" />
        (end)
    */
    path: function DomTal_modifiers_path( exp ) {
        var v;

        // check if it's a number
        if ( (m = exp.match(/^\s*(-?[0-9]+(\.[0-9]+)?)\s*$/)) ) {
            return parseFloat(m[1]);
        // check if it's true or false
        } else if ( (m = exp.match(/^\s*(true|false)\s*$/i)) ) {
            return (m[1].toLowerCase() === 'true');
        // check if it's a structure
        } else if ( (m = exp.match(/^\s*structure\s+(.+)$/)) ) {
            v = this.getByPath( m[1] );
            if (!v) {
                return null;
            } else if (typeof v === 'string') {
                return this.stringToDom( v );
            } else {
                return v;
            }
        }

        // otherwise it should be a path, check for its variable
        return this.getByPath( exp );
    },

    /*
    Modifier: exists
        This modifier returns true if the given path exists or false if it does
        not.

        (start code)
        "exists: path/to/var"
        (end)

    Examples:
        (start code)
        @xml
        <span tal:condition="exists: user">
            Welcome ${user/name}
        </span>
        (end)
    */
    exists: function DomTal_modifiers_exists( exp ) {
        return (typeof this.getByPath( exp ) !== 'undefined');
    },

    /*
    Modifier: not
        This modifier just negates the result of the given expression. It's
        specially useful when used in the _condition_ processor.

        (start code)
        "not: path/to/var"
        (end)

    Examples:
        (start code)
        @xml
        <span tal:condition="not: cart/items">
            There are no items in your cart
        </span>
        (end)
    */
    not: function DomTal_modifiers_not( exp ) {
        return !this.tales( exp );
    },

    /*
    Modifier: string
        This modifier parses the given string interpolating any variables
        defined in it. A shortcut for this modifier is to embedd the string in
        single quotes.

        (start code)
        string: A ${interpolated} string
        'A ${interpolated} string'
        (end)

    Examples:
        (start code)
        @xml
        <span tal:content="string: Hello ${user}" />
        <span tal:content="'Hello ${user}'" />
        (end)
    */
    string: function DomTal_modifiers_string( str ) {
        return this.interpolate( str );
    },

    /*
    Modifier: js
        This modifier evaluates the expression as plain Javascript code after
        interpolating the expression for any variables.

        (start code)
        "js: javascript code"
        (end)

    Note:
        Try to not abuse this modifier, the code is passed thru eval() which
        would make its debugging more difficult. Moreover, the tales parser is
        quite weak so it's possible that any non simple javascript literal could
        break it.
        If you need a special functionality try creating a custom modifier, they
        are very easy to implement and should also be a bit faster than eval'd
        code.

    Examples:
        This will make a list with 10 items in it from 0 to 9
        (start code)
        @xml
        <ul tal:repeat="elem js: new Array(10)">
            <li tal:content="repeat/elem/index" />
        </ul>
        (end)

        This will do the same but the number of items is defined in a variable
        (start code)
        @xml
        <ul tal:repeat="elem js: new Array(${path/to/numItems})">
            <li tal:content="repeat/elem/index" />
        </ul>
        (end)
    */
    js: function DomTal_modifiers_js( exp ) {
        var result;

        exp = this.interpolate(exp);

        try {
            result = eval( '(' + exp + ')' );
        } catch(e) {
            this.log('Error evaling JS expression: "' + exp + '" (' + e + ')');
        }

        return result;
    },

    /*
    Modifier: bool
        This modifier casts the expression value to a boolean. It understands strings
        with Yes/No, On/Off and True/False. A string of '0' is casted to false.

        (start code)
        "bool: path/to/var"
        (end)

    Examples:
        (start code)
        @xml
        <input type="checkbox" tal:attributes="checked bool:user/active" />
        (end)
    */
    bool: function DomTal_modifiers_bool(exp){
        var value = this.tales(exp);

        if (typeof value === 'string') {
            value = value.toUpperCase();
            if (/^[0-9\.]+$/.test(value) && parseInt(value, 10) == value) {
                value = parseInt(value, 10);
            } else if (value in {'NO':0, 'OFF':0, 'FALSE':0}) {
                value = false;
            }
        }

        return !!value;
    },

    /*
    Modifier: int
        This modifier casts the expression value to an integer

        (start code)
        "int: path/to/var"
        (end)

    Examples:
        (start code)
        @xml
        <span>${int:user/age}</span>
        (end)
    */ 
    'int': function DomTal_modifiers_int(exp){
        var value = parseInt(this.tales(exp), 10);
        return isNaN(value) ? 0 : value;
    },

    /*
    Modifier: float
        This modifier casts the expression value to a float 

        (start code)
        "float: path/to/var"
        (end)

    Examples:
        (start code)
        @xml
        <span>${float:item/ratio}</span></span>
        (end)
    */
    'float': function DomTal_modifiers_float(exp){
        var value = parseFloat(this.tales(exp));
        return isNaN(value) ? 0.0 : value;
    },

    /*
    Modifier: fixed
        This modifier casts the expression value to a float with the given decimals

        (start code)
        "fixed: cfg/decimals path/to/var"
        (end)

    Examples:
        (start code)
        @xml
        <span>${fixed:2 item/ratio}</span></span>
        (end)
    */
    fixed: function DomTal_modifiers_fixed(exp){
        var parts = this.split(exp, ' '),
            decimals = this.tales(parts.shift());

        exp = this.tales(parts.join(' '));

        exp = parseFloat(exp);
        return isNaN(exp) ? (0).toFixed(decimals) : exp.toFixed(decimals);
    }
};
