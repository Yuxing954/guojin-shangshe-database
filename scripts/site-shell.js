(function(){
  'use strict';
  const U=SiteUI,page=location.pathname.split('/').pop()||'industry.html';
  const [section,title]=U.pages[page]||['tools','研究工具'];
  document.body.classList.add('site-page');document.body.dataset.siteSection=section;
  // Apply Tabler components to both initial markup and asynchronously loaded data.
  // Existing IDs, state classes, native dialogs and business event handlers stay intact.
  if(document.body.dataset.ui==='tabler'){
    const components=[
      ['main select,.site-main select','form-select'],
      ['main input[type=search],main input[type=text],main input[type=date],main input[type=number]','form-control'],
      ['.portal-button,.hd-export,.gj-button,.oh-actions>button,.oh-actions>a,.ec-export button','btn'],
      ['.hd-card:not(details),.gj-card:not(details),.oh-block,.travel-panel,.cruise-panel,.dining-panel,.portal-panel,.research-controls,.portal-research-list,.research-tool','card'],
      ['.hd-card-head,.gj-card-head,.portal-panel-head,.quotes-board-head','card-header'],
      ['main h1','page-title']
    ];
    const enhance=root=>{
      if(root.nodeType!==1)return;
      for(const [selector,className] of components){
        if(root.matches(selector))root.classList.add(className);
        root.querySelectorAll(selector).forEach(node=>node.classList.add(className));
      }
    };
    enhance(document.body);
    new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes)enhance(node);
    }).observe(document.body,{childList:true,subtree:true});
  }
  if(typeof window!=='undefined'&&window.parent!==window&&new URLSearchParams(location.search).get('embed')==='1'){
    document.querySelectorAll('.site-workspace-bar,[data-site-shell-heading]').forEach(node=>node.remove());
    const main=document.querySelector('body > main,body > .wrap');if(main)main.classList.add('site-main');return;
  }
  const isProduct=U.products.some(([href])=>href===page);
  const productOpen=isProduct&&matchMedia('(min-width:761px)').matches;
  const nav=document.querySelector('body > .site-nav')||document.createElement('aside');
  nav.className='site-nav navbar navbar-vertical';
  nav.innerHTML=U.shellNavigation(page,section,productOpen);
  document.body.prepend(nav);
  const productToggle=nav.querySelector('#site-products-toggle'),productPanel=nav.querySelector('#site-products-panel');
  const setProductsOpen=open=>{productToggle.setAttribute('aria-expanded',String(open));productPanel.hidden=!open;};
  productToggle.addEventListener('click',()=>setProductsOpen(productPanel.hidden));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!productPanel.hidden){const restore=productPanel.contains(document.activeElement);setProductsOpen(false);if(restore)productToggle.focus();}});
  document.addEventListener('click',event=>{if(!productPanel.hidden&&!productPanel.contains(event.target)&&!productToggle.contains(event.target))setProductsOpen(false);});
  const main=document.querySelector('body > main,body > .wrap,body > .main,body > .app > .main,body > .shell > .main')||document.querySelector('main');
  if(main){
    main.classList.add('site-main','page-body');
    if(!main.id)main.id='site-main';main.tabIndex=-1;main.setAttribute('aria-label',title);
    if(!main.querySelector('h1')){
      const heading=document.createElement('h1');heading.className='page-title site-page-heading';heading.dataset.siteShellHeading='';heading.textContent=title;main.prepend(heading);
    }
    const bar=document.querySelector('.site-workspace-bar')||document.createElement('header');
    bar.className='site-workspace-bar';
    bar.innerHTML=U.workspaceBar(title);
    main.before(bar);
    const searchInput=bar.querySelector('.catalog-search input');
    document.addEventListener('keydown',event=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();searchInput.focus();
      }
    });
    if(document.querySelector('.skip-link'))document.querySelector('.skip-link').href='#'+main.id;
    else{const skip=document.createElement('a');skip.href='#'+main.id;skip.className='skip-link';skip.textContent='跳到内容';document.body.prepend(skip);}
  }

  document.querySelectorAll('dialog').forEach(dialog=>{
    if(!dialog.hasAttribute('aria-labelledby')&&!dialog.hasAttribute('aria-label')){const heading=dialog.querySelector('h2,h3');if(heading&&heading.id)dialog.setAttribute('aria-labelledby',heading.id);else dialog.setAttribute('aria-label',title+'详情');}
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  });
})();



