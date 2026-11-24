export const finite = value => typeof value === 'number' && Number.isFinite(value);
export const unique = values => [...new Set(values)];
export const currencyLabel = currency => ({ CNY: '元', USD: '美元', EUR: '欧元', HKD: '港元' })[currency] || currency || '';

export function csv(headers, rows) {
  const cell = value => {
    let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (typeof value !== 'number' && /^[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}

// The old operating model owns period/sample selection. Each company retains
// its disclosed region, category, operation and currency; no cross-company
// aggregate or synthetic peer series is produced here.
export function domesticSelection(model, data, state, requested = {}) {
  const defaults = model.mainFilters(data.company, state.kind, state.frequency);
  let rows = model.select(model.windowRows(data.rows, state.frequency), { kind: state.kind });
  const filters = { kind: state.kind }, options = {};
  for (const key of ['region', 'currency', 'category', 'mode']) {
    options[key] = unique(rows.map(row => row[key]).filter(value => value != null && value !== ''));
    const wanted = requested[key] ?? defaults[key];
    filters[key] = options[key].includes(wanted) ? wanted : options[key].includes(defaults[key]) ? defaults[key] : options[key][0] || '';
    rows = model.select(rows, { [key]: filters[key] });
  }
  return { filters, options, rows };
}

export function domesticEvidence(data, row) {
  if (!row) return null;
  const source = typeof row.source === 'number' ? data.sources?.[row.source] : null;
  return {
    name: data.company.name + ' · ' + row.period + ' · ' + row.metric,
    period: row.period,
    value: row.value,
    prior: row.prior,
    change: row.change,
    changeUnit: row.metric === 'OCC' ? '百分点' : '%',
    sample: row.kind,
    region: row.region,
    category: row.category,
    operation: row.mode,
    currency: row.currency,
    ...(source || {}),
    ...(row.evidence || {}),
    url: row.evidence?.url || source?.url || (typeof row.source === 'string' ? row.source : ''),
  };
}

export function domesticCsv(dataSets, quarterRows) {
  const headers = ['公司', '报告期', '样本', '地区', '档次', '经营模式', '指标', '数值', '币种', '上年同期', '同比', '同比单位', '来源URL', 'PDF物理页码', '来源说明', '同比口径'];
  const rows = [];
  for (const [companyId, periods] of quarterRows) {
    const data = dataSets.find(item => item.company.id === companyId);
    for (const period of periods) for (const row of period.records) {
      if (!row) continue;
      const source = domesticEvidence(data, row);
      rows.push([data.company.name, row.period, row.kind, row.region, row.category, row.mode, row.metric, row.value, row.currency, row.prior, row.change, row.metric === 'OCC' ? '百分点' : '%', source.url, source.pdf_page, source.note, source.comparison_basis]);
    }
  }
  return csv(headers, rows);
}

export async function catalogData(api, companyId, databaseModel, overviewModel) {
  const [catalog, sources, supplements, workbook, choice] = await Promise.all([
    api.json('data/companies/catalog.json'),
    api.json('data/companies/sources.json'),
    api.json('data/companies/supplements.json'),
    api.json('data/companies/workbook-disclosures.json'),
    api.json('data/companies/choice.json'),
  ]);
  const company = catalog.companies.find(item => item.id === companyId);
  if (!company) throw new Error('公司不在综合数据目录中');
  const index = await api.json(company.file);
  const loadParts = async paths => (await Promise.all(paths.map(path => api.json(path)))).flatMap(part => part.observations || []);
  const [base, supplementRows, workbookRows, choiceRows] = await Promise.all([
    index.observations ? Promise.resolve(index.observations) : loadParts(index.parts || []),
    loadParts(supplements.parts || []),
    loadParts(workbook.companyParts?.[companyId] || (workbook.parts || []).filter(path => path.includes('/' + companyId + '/'))),
    loadParts(choice.parts || []),
  ]);
  const extra = [...supplementRows, ...workbookRows, ...choiceRows].filter(row => row.companyId === companyId);
  const rows = overviewModel.merge(base, extra);
  const sourceMap = new Map([...(sources.sources || []), ...(supplements.sources || []), ...(workbook.sources || []), ...(choice.sources || [])].map(source => [source.id, source]));
  return { company, catalog, rows, sourceMap };
}
