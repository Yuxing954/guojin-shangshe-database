const assert=require('node:assert/strict');const D=require('./site-data.js');
assert.deepEqual(D.csv('\uFEFF名称,正文,链接\r\n公司,"第一行\n第二行，""引用""",https://example.com\r\n'),[{名称:'公司',正文:'第一行\n第二行，“引用”'.replace('“','"').replace('”','"'),链接:'https://example.com'}]);
assert.equal(D.number(''),null);assert.equal(D.number('NaN'),null);assert.equal(D.number('0'),0);assert.equal(D.number('1,234'),1234);
assert.equal(D.link('javascript:alert(1)'),'');assert.equal(D.link('{"link":"https://example.com/file.docx"}'),'https://example.com/file.docx');
assert(D.period('2026Q3')>D.period('2026H1'));assert(D.period('FY2025')>D.period('2025Q3'));assert(D.period('2026Q1')>D.period('FY2025'));
assert(!D.trend([{date:'2026-01',value:0},{date:'2026-02',value:0}],'<test>').includes('NaN'));assert(D.trend([{date:'2026-01',value:1}],'<test>').includes('&lt;test&gt;'));
console.log('CSV、空值、安全链接、报告期顺序、图表边界检查通过');
