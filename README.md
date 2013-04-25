DomTal
======

A TAL template parser for javascript.

copyright (c) 2005-2012 Iván -DrSlump- Montes <http://pollinimini.net>


Credits
-------

   - The script originated from work by Joachim Zobel <http://www.heute-morgen.de/test/About_DOMTAL.html>
 
Known issues
------------

  - This script uses the own browser to parse the html, so you must be carefull 
    with the validity of the code. A common mistake is to use the short syntax 
    `<tag />` for elements which shouldn't according to the standard.
    It's always a good idea to use the full syntax (except for `<br/>` and `<hr/>`) 
    even when no content is defined.

  - In Internet Explorer the tal attributes (processors) can't be removed from
    the generated code although this shouldn't affect anything.

Differences with standard TAL
-----------------------------

  - The default tales prefix/modifier is _js_, which resolves a basic javascript
    statement instead of a simple path to a variable.
  - No support for `tal:block` element.
  - No support for `tal:on-error` processor.
  - No support for `Metal`, however a similar behaviour can be mimicked with
    document fragments and common tal processors.
  - `omit-tag` works a bit differently. If the tales expression evaluates to true 
    the tag is removed and its contents shown, otherwise the tag is also shown.
    This is an intended change and can be easily removed by creating a custom
    wrapper for this processor.


TODO
----

 - Check for performance bottlenecks and memory leaks

-----------------------------------------------------------------------------

Usage
=====

First we need to have a template somewhere in the page. Be it as an html
string, a containing element or a document fragment.

     <div id="myTemplate" style="display: none">
         <table>
         <tr>
             <th>Username</th>
             <th>E-Mail</th>
         </tr>
         <tr tal:repeat="user users"
             tal:attributes="class js:${repeat.user.odd}?'odd':'even'">
             <td tal:content="user.name"></td>
             <td>${user.email}</td>
         </tr>
         </table>
     </div>

we could also use an html string, either as a javascript string literal or
by using the script tag

     <script type="template/domtal" id="myTemplate"><![CDATA[
     <table>
     <tr>
         <th>Username</th>
         <th>E-Mail</th>
     </tr>
     <tr tal:repeat="user users"
         tal:attributes="class js:${repeat.user.odd}?'odd':'even'">
         <td tal:content="user.name"></td>
         <td>${user.email}</td>
     </tr>
     </table>
     ]]></script>

next we need to create the template object and set the apropiate data. Note
that we can create the data set anyway we want, even loading it with JSON or
similar remoting methods.

     var tpl = new DomTal();
     tpl.set( 'users', [{
       name: 'Joe Black',
       email: 'jblack@yahoo.co.uk'
     }, {
       name: 'Mike Flowers',
       email: 'mike.flowers@aol.es'
     }]);

now we just need to assign our template to the parser, process it and get
the result

     tpl.load( document.getElementById('myTemplate') );
     var out = tpl.run();
     // put the result on the page
     document.getElmentById('outUsers').appendChild( out );

And that's it. There a few more options but overall it's a pretty easy to
use library.


Customization
=============

Creating a new processor
------------------------

To extend the available processors we only need to create (or redefine) a
method in *DomTal.processors*. Be aware that the order in which the
processor methods are defined in the code specify their priority. The
standard ones are applied in this order:
   `define`, `condition`, `repeat`, `content`, `replace`, `attributes`, `omit-tag`

The return value of a processor has meaning. If it returns _true_ then the
children elements of that node will be further processed, alternatively, if
it returns _false_ its children will be skipped.

We are going to create a new processor which will convert an array items to
a set of LI elements. It'll apply a class named 'selected' to the LI whose
key is equal to the second tales expression:
 
     <ul tal:li="path.to.array selectedKey" />

The processor implementation:

     DomTal.prototype.processors.li = function (node, exp) {
         var tales, key, arr;

         exp = new ExpressionParser(exp);
         tales = exp.tales();
         key = exp.ident();

         tales = this.tales(tales);
         arr = this.makeIterable(tales);

         node.innerHTML = '';
         if (arr.count) {
             for (var i=0; i<arr.count; i++) {
                 var li = document.createElement('LI');
                 if (arr.keys[i] == key)
                     li.setAttribute('class', 'selected');
                 li.appendChild( document.createTextNode( arr.values[i] ) );
                 node.appendChild( li );
             }
         }

         return false;
     }

The following expression with a data set of ['one', 'two', 'three']

     <ul id="list" tal:li="data 1">
       <li>Test item</li>
     </ul>

will generate the following html

     <ul id="list">
       <li>one</li>
       <li class="selected">two</li>
       <li>three</li>
     </ul>


Creating a new tales modifier
-----------------------------

We can also add our own _Tales_ modifiers by extending the *DomTal.modifiers*
object with new methods. The methods just take an argument with the
expression to evaluate and should return the result of that argument.

In this example we are going to create a modifier which will evaluate to the string
'odd' or 'even' based on the value of an expression.

     DomTal.prototype.modifiers.oddeven = function(exp) {
         var value;
         value = this.tales(exp);
         return (value % 2) ? 'odd' : 'even';
     }

then the following template

     <span tal:content="oddeven: 3">foo</span>

will produce

     <span class="odd">foo</span>


