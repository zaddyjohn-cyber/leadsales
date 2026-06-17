/* ================================================================
   SHARED AD ANIMATION
   Drives the looping "live lead request" mockup used by both
   ad-square.html (1:1) and ad-vertical.html (9:16).
   Types the keyword, runs a search spinner, reveals result rows,
   shows the delivery badge, pops the "Request received" toast,
   then cycles through several niche/country scenarios.
   ================================================================ */
(function () {
  const mock = document.getElementById('mock');
  if (!mock) return;

  const els = {
    search: document.getElementById('mockSearch'),
    text:   document.getElementById('mockText'),
    caret:  document.getElementById('mockCaret'),
    btn:    document.getElementById('mockBtn'),
    rowType:    document.getElementById('rowType'),
    rowCountry: document.getElementById('rowCountry'),
    rowRegion:  document.getElementById('rowRegion'),
    rowDeliver: document.getElementById('rowDeliver'),
    toast:  document.getElementById('mockToast'),
    valType:    document.getElementById('valType'),
    icoType:    document.getElementById('icoType'),
    valCountry: document.getElementById('valCountry'),
    icoCountry: document.getElementById('icoCountry'),
    labRegion:  document.getElementById('labRegion'),
    valRegion:  document.getElementById('valRegion'),
  };

  // Edit this list to change the scenarios that cycle on screen.
  const SCENES = [
    { kw:'Dentists',           kwIco:'🦷',  country:'United States', cIco:'🇺🇸', regLabel:'State', region:'Texas' },
    { kw:'Roofers',            kwIco:'🛠️', country:'United Kingdom', cIco:'🇬🇧', regLabel:'City',  region:'London' },
    { kw:'Restaurants',        kwIco:'🍽️', country:'Canada',        cIco:'🇨🇦', regLabel:'City',  region:'Toronto' },
    { kw:'Real estate agents', kwIco:'🏠',  country:'Australia',     cIco:'🇦🇺', regLabel:'City',  region:'Sydney' },
  ];

  const wait = ms => new Promise(r => setTimeout(r, ms));

  function resetRows() {
    [els.rowType, els.rowCountry, els.rowRegion].forEach(r => r.classList.remove('show'));
    els.rowDeliver.classList.remove('show');
    els.toast.classList.remove('show');
  }

  async function typeText(str) {
    els.text.classList.remove('placeholder');
    els.text.textContent = '';
    els.caret.classList.remove('hide');
    els.search.classList.add('is-focus');
    for (let i = 0; i < str.length; i++) {
      els.text.textContent += str[i];
      await wait(70 + Math.random() * 60);
    }
    await wait(350);
    els.caret.classList.add('hide');
  }

  function searching(on) {
    els.btn.innerHTML = on ? '<span class="spinner"></span> Searching' : 'Search';
  }

  async function runScene(s) {
    els.valType.textContent = s.kw;          els.icoType.textContent = s.kwIco;
    els.valCountry.textContent = s.country;  els.icoCountry.textContent = s.cIco;
    els.labRegion.textContent = s.regLabel;  els.valRegion.textContent = s.region;

    resetRows();
    els.text.classList.add('placeholder');
    els.text.textContent = 'Search a business type…';
    els.search.classList.remove('is-focus');
    await wait(600);

    await typeText(s.kw);
    searching(true);
    await wait(950);
    searching(false);

    els.rowType.classList.add('show');    await wait(280);
    els.rowCountry.classList.add('show'); await wait(280);
    els.rowRegion.classList.add('show');  await wait(320);
    els.rowDeliver.classList.add('show'); await wait(520);
    els.toast.classList.add('show');

    await wait(3200);
  }

  (async function loop() {
    let i = 0;
    while (true) {
      await runScene(SCENES[i % SCENES.length]);
      i++;
    }
  })();
})();
