// 云端收藏：favorites 表（owner_id 由数据库 DEFAULT auth.uid() 自动填充，客户端不传）
const { cloud } = require('./cloud');

// 去重键：views 用 topicId，minutes 用标题+日期
function refKeyOf(kind, item) {
  if (kind === 'view') return String(item.topicId || (item.t || '') + '|' + (item.title || ''));
  return String((item.title || '') + '|' + (item.date || ''));
}

async function ensureSession() {
  const { data: session, error } = await cloud.auth.getSession();
  if (error) {
    console.error('[Favorites] session error', JSON.stringify({ stage: 'auth', message: error.message }));
    return null;
  }
  return session || null;
}

async function list(kind) {
  if (!(await ensureSession())) return { error: 'not-signed-in' };
  const { data, error } = await cloud.database
    .from('favorites')
    .select('id, kind, ref_key, title, author, body, link, meta, created_at')
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('[Favorites] list error', JSON.stringify({ stage: 'db', message: error.message, code: error.code }));
    return { error: friendly(error) };
  }
  return { data };
}

async function toggle(kind, item) {
  if (!(await ensureSession())) return { error: 'not-signed-in' };
  const ref_key = refKeyOf(kind, item);
  // 先查是否存在（RLS 只返回自己的行）
  const { data: found, error: qErr } = await cloud.database
    .from('favorites')
    .select('id')
    .eq('kind', kind)
    .eq('ref_key', ref_key)
    .maybeSingle();
  if (qErr) {
    console.error('[Favorites] query error', JSON.stringify({ stage: 'db', message: qErr.message, code: qErr.code }));
    return { error: friendly(qErr) };
  }
  if (found) {
    // 取消收藏
    const { data: removed, error: dErr } = await cloud.database
      .from('favorites')
      .delete()
      .eq('id', found.id)
      .select();
    if (dErr) return { error: friendly(dErr) };
    const removedCount = Array.isArray(removed) ? removed.length : 0;
    if (removedCount === 0) return { error: '操作未生效，请重试' };
    return { removed: true };
  }
  // 新增收藏（不传 owner_id，DB 自动填充）
  const { error: iErr } = await cloud.database
    .from('favorites')
    .insert({
      kind,
      ref_key,
      title: (item.title || '').slice(0, 200),
      author: (item.author || '').slice(0, 100),
      body: ((item.body || item.summary || '')).slice(0, 600),
      link: item.link || '',
      meta: { t: item.t || item.date || '', topic: item.topic || '', source: kind }
    });
  if (iErr) {
    if (iErr.code === '23505') return { error: '已在收藏中' };
    console.error('[Favorites] insert error', JSON.stringify({ stage: 'db', message: iErr.message, code: iErr.code }));
    return { error: friendly(iErr) };
  }
  return { added: true };
}

function friendly(err) {
  const code = err && err.code;
  if (code === '42501') return '没有权限执行此操作';
  if (code === '42P01') return '收藏表尚未就绪';
  if (code === '23505') return '已在收藏中';
  return '云端操作失败，请检查网络后重试';
}

module.exports = { refKeyOf, list, toggle, ensureSession };
