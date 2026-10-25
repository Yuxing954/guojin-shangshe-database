'use strict';
// Exercise the same folded controls users open before changing annotations.
async function openAnnotation(control){
 const menu=control.locator('xpath=ancestor::details[contains(concat(" ", normalize-space(@class), " "), " site-value-menu ")]');
 if(await menu.count()&&await menu.getAttribute('open')===null)await menu.locator(':scope > summary').click();
}
async function setChartLabel(control,checked=true){await openAnnotation(control);await control.setChecked(checked);}
module.exports={openAnnotation,setChartLabel};
