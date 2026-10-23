(function(){
 'use strict';
 // Small-size, single-colour redraws of the existing brand assets, not generic category icons.
 // Source references are retained in scripts/assets/domestic-hotels and overseas-hotels.
 const marks={
  jinjiang:{source:'domestic-hotels/jinjiang.png',view:'0 0 64 52',path:'M39 6C26-1 13 1 12 12C10 25 25 43 42 47C55 50 62 44 58 32L48 11L40 10L49 31C54 42 47 44 37 40C24 35 14 20 17 11C19 5 27 4 35 7M39 6L35 7'},
  btg:{source:'domestic-hotels/btg.png',view:'0 0 76 40',path:'M8 15C-6 7 14 2 38 2C62 2 82 7 68 15M9 12C-1 8 17 5 38 5C59 5 77 9 67 12M9 19V35H17C25 35 25 27 17 27H9M17 27C24 27 24 19 17 19H9M29 19H47M38 19V35M66 22C61 16 51 19 51 27C51 36 61 38 67 33V27H60'},
  hworld:{source:'domestic-hotels/hworld-group.png',view:'0 0 42 42',path:'M24 1C34 1 41 13 41 23C41 33 33 41 23 41C12 41 1 35 1 25C1 15 14 1 24 1ZM14 11C17 11 17 12 17 14V19C17 20 18 20 19 20H25C26 20 27 20 27 19V14C27 12 27 11 30 11M14 31C17 31 17 30 17 28V24C17 23 18 22 19 22H25C26 22 27 23 27 24V28C27 30 27 31 30 31M14 11V31M30 11V31'},
  atour:{source:'domestic-hotels/atour-group.jpg',view:'0 0 64 36',path:'M3 5H29M3 31H29M12 5V31M21 5V31M3 12L8 25M29 12L24 25M38 15C43 13 44 9 44 4H56V11C56 14 58 15 62 15M35 20H63M49 16V33M48 21C45 26 40 30 35 32M50 21C53 26 58 30 63 32'},
  // Marriott's distinctive double-M silhouette, traced from marriott.svg.
  marriott:{source:'overseas-hotels/marriott.svg',view:'0 0 480 370',path:'M314.2 1l152 327.3h-87.6l-60.2-129.4-22.2 47.7 38 81.6h-87.7l-60.1-129.4-33.1 71.1c-26.8 57.7-57.6 85-99.7 85-18.4-.3-36.6-4.1-53.6-11.2l33.6-72.1c9.2 3.3 18.8 5.1 28.6 5.3 35.5 0 55.5-15.5 81.4-71 11.5-24.6 18.7-40.1 23.1-49.5l-56.6-121.8 72-33.6 94.5 203.3 22.3-47.7-56.7-121.9Z'},
  hyatt:{source:'overseas-hotels/hyatt.png',view:'0 0 100 36',path:'M3 5V28M18 5V28M3 16H18M26 5L36 19L46 5M36 19V25M43 34L53 4L64 34M66 5H80M73 5V27M85 5H99M92 5V28M14 34Q53 11 91 34'},
  ihg:{source:'overseas-hotels/ihg.svg',view:'0 0 64 32',path:'M4 3V29M16 3V29M33 3V29M16 16H33M60 6C49-3 40 5 40 16C40 28 50 34 61 26V17H54'},
  hilton:{source:'overseas-hotels/hilton.png',view:'0 0 92 36',path:'M1 2H91V34H1ZM8 10H16M12 10V27M8 27H16M24 10H32M28 10V27M24 27H32M12 18H28M36 16H40V27M36 27H44M39 10V11M47 9H51V27M47 27H55M61 11V24Q61 29 66 25M57 16H66M70 17C65 17 65 27 70 27C75 27 75 17 70 17M78 17V27M78 20C81 15 86 16 86 21V27'}
 };
 window.CompanyLogos=Object.fromEntries(Object.entries(marks).map(([id,m])=>[id,'<svg class="cw-brand-mark" data-brand="'+id+'" data-reference="scripts/assets/'+m.source+'" viewBox="'+m.view+'" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="'+m.path+'"/></svg>']));
})();
