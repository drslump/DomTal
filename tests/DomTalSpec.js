// Load dependencies when run from the shell
if (typeof require !== 'undefined') {
    var DomTal = require('./../lib/DomTal.js').DomTal;
}

// A shortcut to expect($(dom)) for Jasmine-jquery plugin
$expect = function(selector, v){

    if (arguments.length < 2) {
        v = selector;
        selector = null;
    }

    // If it's a document fragment we include it in a DOM node, otherwise 
    // jQuery cannot fully query it
    if (typeof v === 'object' && v.nodeType === 11) {
        v = $('<div></div>').append(v.cloneNode(true));
    } else {
        v = $(v);
    }

    // If a selector is given apply it to the subject
    if (selector) {
        v = $(selector, v);
    }

    return expect(v); 
};


describe('DomTal', function(){

    describe('Loading', function(){
        it('should load a template from a string', function(){
            var tal = new DomTal('<div>foo</div>');
            var dom = tal.run();
            $expect(dom).toHaveHtml('<div>foo</div>');
        });
    });

    describe('Interpolation', function(){
        var tal, dom;

        it('should interpolate variables', function(){
            tal = new DomTal('<div>${foo}</div>');
            dom = tal.run({foo:'FOO'});
            $expect('div', dom).toHaveText('FOO');
        });

        it('should interpolate in attributes', function(){
            tal = new DomTal('<div name="${foo}">foo</div>');
            dom = tal.run({foo:'FOO'});
            $expect('div', dom).toHaveAttr('name', 'FOO');
        });

        it('should escape interpolation marks', function(){
            tal = new DomTal('<div>$${foo}</div>');
            dom = tal.run({foo:'FOO'});
            $expect(dom).toHaveText('$${foo}');
        });

        it('should interpolate escaping HTML', function(){
            tal = new DomTal('<div>${foo}</div>');
            dom = tal.run({foo:'<br />'});
            $expect(dom).toHaveText('<br />');
        });

        it('should interpolate ignoring structure flag', function(){
            tal = new DomTal('<div>${structure foo}</div>');
            dom = tal.run({foo:'<br/>'});
            $expect(dom).not.toContain('br');
            $expect(dom).toHaveText(/br/i);
        });

    });

    describe('Processors', function(){
        var dom, tal;

        beforeEach(function(){
            tal = new DomTal();
        });

        describe('Define', function(){
            it('as a local variable', function(){
                tal.load('<span tal:define="foo \'bar\'">-${foo}-</span>\
                        <p>-${foo}-</p>');
                dom = tal.run({foo:'baz'});
                $expect('span', dom).toHaveText('-bar-');
                $expect('p', dom).toHaveText('-baz-');
            });

            it('as a global variable', function(){
                tal.load('<span tal:define="global foo \'bar\'">-${foo}-</span> \
                        <p>-${foo}-</p>');
                dom = tal.run({foo:'baz'});
                $expect('span', dom).toHaveText('-bar-');
                $expect('p', dom).toHaveText('-bar-');
            });

            it('from content', function(){
                tal.load('<span tal:define="global foo">bar</span> \
                        <p>-${foo}-</p>');
                dom = tal.run();
                $expect('p', dom).toHaveText('-bar-');
            });

            it('from html content', function(){
                tal.load('<div tal:define="global foo"><em>bar</em></div>\
                        <p>${foo}</p>');
                dom = tal.run();
                $expect('p', dom).toHaveText(/bar/);
            });
        });

        describe('Content', function(){
            it('filling empty element', function(){
                tal.load('<span tal:content="foo" />');
                dom = tal.run({foo: 'FOO'});
                $expect('span', dom).toHaveText('FOO');
            });

            it('replacing child elements', function(){
                tal.load('<span tal:content="foo"><p>foo<br/>bar</p></span>');
                dom = tal.run({foo: 'FOO'});
                $expect('span', dom).toHaveText('FOO');
            });

            it('inserting HTML content', function(){
                tal.load('<span tal:content="structure foo" />');
                dom = tal.run({foo: 'foo<br/>bar'});
                $expect('span', dom).toContain('br');
            });
        });

        describe('Replace', function(){
            it('an empty element', function(){
                tal.load('<span tal:replace="foo" />');
                dom = tal.run({foo: 'FOO'});
                $expect(dom).not.toContain('span');
                $expect(dom).toHaveText('FOO');
            });

            it('a non empty element', function(){
                tal.load('<span tal:replace="foo"><p>foo<br/>bar</p></span>');
                dom = tal.run({foo: 'FOO'});
                $expect(dom).not.toContain('span');
                $expect(dom).toHaveText('FOO');
            });

            it('replacing with HTML content', function(){
                tal.load('<span tal:replace="structure foo" />');
                dom = tal.run({foo: 'foo<br/>bar'});
                $expect(dom).not.toContain('span');
                $expect(dom).toContain('br');
            });

        });

        describe('Omit-Tag', function(){
            it('should omit the tag if no expression is given', function(){
                tal.load('<span tal:omit-tag="">foo</span>');
                dom = tal.run();
                $expect(dom).not.toContain('span');
                $expect(dom).toHaveText('foo');
            });

            it('should omit the tag if expression is truly', function(){
                tal.load('<span tal:omit-tag="1">foo</span>');
                dom = tal.run();
                $expect(dom).not.toContain('span');
                $expect(dom).toHaveText('foo');
            });

            it('should not omit the tag if expression is falsy', function(){
                tal.load('<span tal:omit-tag="0">foo</span>');
                dom = tal.run();
                $expect(dom).toContain('span');
                $expect('span', dom).toHaveText('foo');
            });
        });

        describe('Condition', function(){
            it('should accept trully values', function(){
                tal.load('<span tal:condition="1">FOO</span>');
                dom = tal.run();
                $expect('span', dom).toHaveText('FOO');
                tal.load('<span tal:condition="not:0">FOO</span>');
                dom = tal.run();
                $expect('span', dom).toHaveText('FOO');
                tal.load('<span tal:condition="foo">FOO</span>');
                dom = tal.run({foo:true});
                $expect('span', dom).toHaveText('FOO');
            });

            it('should deny falsy values', function(){
                tal.load('<span tal:condition="0">FOO</span>');
                dom = tal.run();
                $expect(dom).not.toContain('span');
                tal.load('<span tal:condition="not:1">FOO</span>');
                dom = tal.run();
                $expect(dom).not.toContain('span');
                tal.load('<span tal:condition="foo">FOO</span>');
                dom = tal.run({foo:false});
                $expect(dom).not.toContain('span');
            });

            it('should deny empty expression', function(){
                tal.load('<span tal:condition="">FOO</span>');
                dom = tal.run();
                $expect(dom).not.toContain('span');
            });
        });

        describe('Repeat', function(){
            it ('should iterate over array', function(){
                tal.load('<li tal:repeat="foo array">${foo}</li>');
                dom = tal.run({array: [1,2,3,4,5]});
                $dom = $expect(dom).actual;
                expect($('li', $dom).length).toBe(5);
                $expect('li:nth-child(1)', dom).toHaveText('1');
                $expect('li:nth-child(3)', dom).toHaveText('3');
            });

            it('should iterarte over object', function(){
                tal.load('<li tal:repeat="foo object">${repeat/foo/key}:${foo}</li>');
                dom = tal.run({object:{a:1,b:2,c:3,d:4,e:5}});
                $dom = $expect(dom).actual;
                expect($('li', $dom).length).toBe(5);
                $expect('li:nth-child(1)', dom).toHaveText('a:1');
                $expect('li:nth-child(3)', dom).toHaveText('c:3');
            });

            it('should provide meta information', function(){
                tal.load('<li tal:repeat="foo array">${repeat.foo.index}/${repeat.foo.number}</span>');
                dom = tal.run({array:[1,2,3]});
                $expect('li:nth-child(1)', dom).toHaveText('0/1');
                $expect('li:nth-child(3)', dom).toHaveText('2/3');

                tal.load('<li tal:repeat="foo array">${repeat.foo.even}/${repeat.foo.odd}</span>');
                dom = tal.run({array:[1,2,3]});
                $expect('li:nth-child(1)', dom).toHaveText('false/true');
                $expect('li:nth-child(2)', dom).toHaveText('true/false');

                tal.load('<li tal:repeat="foo array">${repeat.foo.start}/${repeat.foo.end}</span>');
                dom = tal.run({array:[1,2,3]});
                $expect('li:nth-child(1)', dom).toHaveText('true/false');
                $expect('li:nth-child(2)', dom).toHaveText('false/false');
                $expect('li:nth-child(3)', dom).toHaveText('false/true');

                tal.load('<li tal:repeat="foo array">${repeat.foo.key}/${repeat.foo.length}</li>');
                dom = tal.run({array:[1,2,3]});
                $expect('li:nth-child(1)', dom).toHaveText('0/3');
                $expect('li:nth-child(3)', dom).toHaveText('2/3');
            });

        });

        describe('Attributes', function(){

            it('should define new attributes', function(){
                tal.load('<a tal:attributes="href \'google.com\'">foo</a>');
                dom = tal.run();
                $expect('a', dom).toHaveAttr('href', 'google.com');

                tal.load('<a tal:attributes="name foo; href \'google.com\'">foo</a>');
                dom = tal.run({foo:'FOO'});
                $expect('a', dom).toHaveAttr('href', 'google.com');
                $expect('a', dom).toHaveAttr('name', 'FOO');
            });

            it('should define boolean attributes', function(){
                tal.load('<input type="checkbox" tal:attributes="checked foo" />');
                dom = tal.run({foo:true});
                $expect('input', dom).toBeChecked();

                dom = tal.run({foo:false});
                $expect('input', dom).not.toBeChecked();
            });

            it('should remove attribute', function(){
                tal.load('<span class="foo" tal:attributes="class bool:0></span>');
                dom = tal.run();
                $expect('span', dom).not.toHaveAttr('class');
            });

        });

    });

    describe('Modifiers', function(){

        var tal;

        beforeEach(function(){
            tal = new DomTal();
            tal.set({
                foo: 'FOO',
                bar: 'BAR',
                baz: 'BAZ',
                array: [ 1, 2, 3, 4, 5 ],
                boolTrue: true,
                boolFalse: false,
                numInt: 1231,
                numFloat: 1231.231,
                level0: {
                    value: 'LEVEL0',
                    level1: {
                        value: 'LEVEL1',
                        level2: {
                            value: 'LEVEL2',
                            level3: {
                                value: 'LEVEL3',
                                level4: {
                                    value: 'LEVEL4'
                                }
                            }
                        }
                    }
                }
            });
        });

        // Helper function
        function tales(exp){
            return expect(tal.tales(exp));
        }


        describe('Path', function(){
            it('should access main level variables', function(){
                tales('foo').toBe('FOO');
                tales('boolTrue').toBe(true);
                tales('missing').toBe(undefined);
            });

            it('should access array elements by index', function(){
                tales('array.1').toBe(2);
            });

            it('should access nested structures', function(){
                tales('level0.level1.level2.value').toBe('LEVEL2');
                tales('level0/level1/level2/value').toBe('LEVEL2');
                tales('level0/level1.level2/level3.value').toBe('LEVEL3');
            });
        });

        describe('String', function(){
            it('should support quoted strings', function(){
                tales("'this is a string'").toBe('this is a string');
                tales("   'string'   ").toBe('string');
                tales("'  string  '").toBe('  string  ');
                tales("'escaped''quote'").toBe("escaped'quote");
                tales("'interpolate ${foo}'").toBe('interpolate FOO');
            });

            it('should support non-quoted strings', function(){
                tales('string: this is a string').toBe('this is a string');
                tales("string: quoted 'string'").toBe("quoted 'string'");
                tales("string: interpolate ${foo}").toBe('interpolate FOO');
            });
        });

        describe('Not', function(){
            it('should support literals', function(){
                tales('not:1').toBe(false);
                tales('not:0').toBe(true);
            });
            it('should support paths', function(){
                tales('not:boolTrue').toBe(false);
                tales('not:boolFalse').toBe(true);
                tales('not:foo').toBe(false);
            });
        });

        describe('Exists', function(){
            it('should check existance of paths', function(){
                tales('exists:foo').toBe(true);
                tales('exists:missing').toBe(false);
                tales('exists:level0.level1').toBe(true);
                tales('exists:level0.missing').toBe(false);
            });
        });

        describe('Js', function(){
            it('should evaluate javascript', function(){
                tales('js:1+1').toBe(2);
                tales("js:'foo'.indexOf('o')").toBe(1);
                tales("js:'${foo}'.indexOf('O')").toBe(1);
            });
        });

        describe('Bool', function(){
            it('should cast to boolean', function(){
                tales('bool:0').toBe(false);
                tales('bool:1').toBe(true);
                tales("bool:'0'").toBe(false);
                tales("bool:'on'").toBe(true);
                tales("bool:'off'").toBe(false);
                tales("bool:'true'").toBe(true);
                tales("bool:'false'").toBe(false);
                tales("bool:'yes'").toBe(true);
                tales("bool:'no'").toBe(false);
                tales('bool:foo').toBe(true);
                tales('bool:boolFalse').toBe(false);
            });
        });

        describe('Int', function(){
            it('should cast to integer', function(){
                tales('int:0').toBe(0);
                tales('int:12.32').toBe(12);
                tales('int:12.68').toBe(12);
                tales("int:'foo'").toBe(0);
                tales("int:'123'").toBe(123);
                tales("int:'123.32'").toBe(123);
            });
        });

        describe('Float', function(){
            it('should cast to float', function(){
                tales('float:0').toBe(0.0);
                tales('float:12.32').toBe(12.32);
                tales("float:'foo'").toBe(0);
                tales("float:'123'").toBe(123);
                tales("float:'123.32'").toBe(123.32);
            });
        });

        describe('Fixed', function(){
            it('should cast to float with fixed decimals', function(){
                tales('fixed:2 0').toBe('0.00');
                tales('fixed:1 12.32').toBe('12.3');
                tales('fixed:1 12.68').toBe('12.7');
                tales("fixed:2 'foo'").toBe('0.00');
                tales("fixed:2 '123'").toBe('123.00');
                tales("fixed:2 '123.32321'").toBe('123.32');
            });
        });
    });

    describe('Tales', function(){

        var tal = new DomTal();
        tal.set({
            empty: null,
            zero: 0,
            falsy: false,
            one: 1,
            obj: { },
            str: 'str'
        });

        describe('Alternation', function(){
            it('should support alternation', function(){
                expect(tal.tales('empty | one')).toBe(1);
                expect(tal.tales('empty | zero | falsy | one')).toBe(1);
                expect(tal.tales('empty | zero | falsy')).toBe(false);
                expect(tal.tales('empty | 0 | 1')).toBe(1);
            });

            it('should support nothing keyword', function(){
                expect(tal.tales('empty | one | nothing')).toBe(1);
                expect(tal.tales('empty | nothing')).toBe(DomTal.NOTHING);
            });

            it('should support default keyword', function(){
                expect(tal.tales('empty | one | default')).toBe(1);
                expect(tal.tales('empty | default')).toBe(DomTal.DEFAULT);
            });
        });
    });

});
