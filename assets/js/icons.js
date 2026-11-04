
window.TajIcons = (function(){
  var P = {
    menu:'<path d="M4 7h16M4 12h16M4 17h10"/>',
    close:'<path d="M6 6l12 12M18 6L6 18"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 5v16"/><path d="M9 7h6"/>',
    quiz:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><circle cx="12" cy="16.5" r=".6"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    pencil:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    share:'<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
    play:'<path d="M8 5.5v13l10-6.5z"/>',
    stop:'<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
    chat:'<path d="M4 5h16v11H9l-5 4z"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5L12 13l8.5-6.5"/>',
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    spark:'<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>',
    star:'<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19.6l1-5.8-4.2-4.1 5.9-.9z"/>',
    heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    school:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v6"/>',
    shelf:'<path d="M3 4v16M21 4v16M3 9h18M3 15h18"/><path d="M7 9V5M10 9v-4M14 15v-6M17 15v-3"/>',
    doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.6 0 4.5 1.5 5 4.4"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pin:'<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    upload:'<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    logout:'<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h11"/>',
    whatsapp:'<path d="M4 20l1.3-4.1A8 8 0 1 1 8.2 18.7z"/><path d="M9 9.5c.2 2.4 2.1 4.4 4.6 5l1-1.1 1.8.9"/>',
    youtube:'<rect x="3" y="6" width="18" height="12" rx="3.5"/><path d="M10.5 9.5v5l4-2.5z"/>',
    instagram:'<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6"/>',
    facebook:'<path d="M14 8h2.5V4.5H14a3.5 3.5 0 0 0-3.5 3.5v2H8V14h2.5v6.5H14V14h2.6l.4-3.5H14V9.2c0-.7.4-1.2 1-1.2z"/>',
    x:'<path d="M4 4l16 16M20 4L4 20"/>',
    alert:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.5"/>',
    install:'<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
    orn:'<path d="M50 6 L62 30 L88 30 L67 46 L75 72 L50 56 L25 72 L33 46 L12 30 L38 30 Z"/><circle cx="50" cy="50" r="22"/><circle cx="50" cy="50" r="10"/><path d="M50 28v44M28 50h44"/>'
  };
  function svg(name, cls){ return '<svg class="'+(cls||'')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(P[name]||'')+'</svg>'; }
  function ornament(cls){ return '<svg class="'+(cls||'')+' orn-draw" viewBox="0 0 100 100" aria-hidden="true" fill="none">'+P.orn.replace(/<path/g,'<path vector-effect="non-scaling-stroke"')+'</svg>'; }
  return { svg: svg, ornament: ornament, names: Object.keys(P) };
})();
