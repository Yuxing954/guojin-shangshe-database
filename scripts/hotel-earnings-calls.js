(function () {
  'use strict';

  const D = SiteData;
  const byId = id => document.getElementById('calls-' + id);
  const company = byId('company');
  const year = byId('year');
  const material = byId('material');
  const status = byId('status');
  const table = byId('table');
  const retry = byId('retry');
  const exportButton = byId('export');
  const materials = {
    official: '官方逐字稿',
    webcast: '官方回放',
    transcript: '第三方逐字稿'
  };
  let data;
  let visible = [];

  function sourceLink(url, title) {
    const href = D.link(url);
    return href ? '<a target="_blank" rel="noopener" href="' + D.esc(href) + '">' + D.esc(title) + '</a>' : '';
  }

  function hasMaterial(row) {
    return Object.keys(materials).some(key => row[key]);
  }

  function render() {
    visible = data.records.filter(row => {
      const selectedMaterial = material.value;
      const matchesMaterial = selectedMaterial === 'missing' ? !hasMaterial(row) : !selectedMaterial || row[selectedMaterial];
      return (!company.value || row.company === company.value)
        && (!year.value || row.period.slice(0, 4) === year.value)
        && matchesMaterial;
    });

    status.textContent = visible.length ? visible.length + ' 条记录' : '没有符合筛选条件的电话会';
    table.hidden = !visible.length;
    exportButton.disabled = !visible.length;
    byId('rows').innerHTML = visible.map(row => {
      const resources = Object.entries(materials).map(([key, title]) => sourceLink(row[key], title)).join('');
      const links = resources || '<span class="calls-pending">待补电话会资料</span>';
      return '<tr><th scope="row">' + D.esc(data.companies[row.company])
        + ' <span class="calls-code">' + D.esc(row.company) + '</span></th>'
        + '<td class="calls-nowrap">' + D.esc(row.period.slice(2)) + '</td>'
        + '<td class="calls-event">' + D.esc(row.event) + '</td>'
        + '<td class="calls-date">' + D.esc(row.date || '—') + '</td>'
        + '<td><div class="calls-links">' + links + sourceLink(row.archive, '公司来源') + '</div></td></tr>';
    }).join('');
  }

  async function load() {
    retry.hidden = true;
    status.textContent = '正在读取电话会目录…';
    try {
      data = await D.json('data/companies/hotel-earnings-calls.json');
      for (const [code, name] of Object.entries(data.companies)) company.add(new Option(name + ' ' + code, code));
      for (const value of new Set(data.records.map(row => row.period.slice(0, 4)))) year.add(new Option(value, value));
      render();
      byId('filters').hidden = false;
    } catch (error) {
      status.textContent = '电话会目录暂时无法读取。';
      retry.hidden = false;
    }
  }

  for (const element of [company, year, material]) element.addEventListener('change', render);
  retry.addEventListener('click', load);
  exportButton.addEventListener('click', () => D.downloadCsv(visible.map(row => ({
    公司: data.companies[row.company],
    代码: row.company,
    报告期: row.period.slice(2),
    会议类型: row.event,
    会议日期: row.date,
    官方逐字稿: row.official,
    官方回放: row.webcast,
    第三方逐字稿: row.transcript,
    公司来源: row.archive
  })), '酒店业绩电话会.csv'));
  load();
})();
