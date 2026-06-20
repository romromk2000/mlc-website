// recurrence-picker.js
// Shared Google Calendar-style recurrence picker for MLC admin + organiser portals.
// Requires rrule.js loaded before this file.

const RP_WD = [
  ['MO','Mon','Monday'], ['TU','Tue','Tuesday'], ['WE','Wed','Wednesday'],
  ['TH','Thu','Thursday'], ['FR','Fri','Friday'], ['SA','Sat','Saturday'], ['SU','Sun','Sunday'],
]
const RP_MONTHS = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December']
const RP_ORD = [[1,'1st'],[2,'2nd'],[3,'3rd'],[4,'4th'],[-1,'Last']]

// ── State ──────────────────────────────────────────────────────────
let rp = {
  eventType: 'recurring', freq: 'WEEKLY', interval: 1,
  days: ['MO'],
  monthlyMode: 'weekday', monthlyPos: 1, monthlyWeekday: 'MO', monthlyDay: 1,
  yearlyMonth: 1, yearlyDay: 1,
  endMode: 'never', count: 10, until: '',
  termTime: false,
}

// ── Init ───────────────────────────────────────────────────────────
function rpInit(v) {
  const now = new Date()
  rp = {
    eventType: v?.event_type || 'recurring',
    freq: 'WEEKLY', interval: 1, days: ['MO'],
    monthlyMode: 'weekday', monthlyPos: 1, monthlyWeekday: 'MO', monthlyDay: 1,
    yearlyMonth: now.getMonth() + 1, yearlyDay: now.getDate(),
    endMode: 'never', count: 10, until: v?.end_date || '',
    termTime: false,
  }
  if (v?.rrule_string) {
    try { _rpParseRrule(v.rrule_string) } catch { _rpParseLegacy(v) }
  } else if (v) {
    _rpParseLegacy(v)
  }
}

function _rpParseLegacy(v) {
  const dm = { Monday:'MO', Tuesday:'TU', Wednesday:'WE', Thursday:'TH', Friday:'FR', Saturday:'SA', Sunday:'SU' }
  const wd = dm[v.day_of_week] || 'MO'
  rp.days = [wd]; rp.monthlyWeekday = wd
  if (!v.recurrence || v.recurrence === 'weekly') { rp.freq = 'WEEKLY'; rp.interval = 1 }
  else if (v.recurrence === 'fortnightly') { rp.freq = 'WEEKLY'; rp.interval = 2 }
  else if (v.recurrence?.startsWith('monthly')) {
    rp.freq = 'MONTHLY'; rp.monthlyMode = 'weekday'
    rp.monthlyPos = parseInt(v.recurrence.split('-')[1]) || 1
  }
}

function _rpParseRrule(str) {
  const rule = RRule.fromString(str)
  const o = rule.origOptions
  const fm = { [RRule.YEARLY]:'YEARLY', [RRule.MONTHLY]:'MONTHLY', [RRule.WEEKLY]:'WEEKLY', [RRule.DAILY]:'DAILY' }
  rp.freq = fm[o.freq] || 'WEEKLY'
  rp.interval = o.interval || 1
  if (Array.isArray(o.byweekday) && o.byweekday.length) {
    const first = o.byweekday[0]
    if (first?.n) {
      rp.monthlyMode = 'weekday'; rp.monthlyPos = first.n
      rp.monthlyWeekday = RP_WD[first.weekday][0]
    } else {
      rp.days = o.byweekday.map(d => RP_WD[typeof d === 'number' ? d : d.weekday][0])
    }
  }
  if (Array.isArray(o.bymonthday) && o.bymonthday.length) { rp.monthlyMode = 'day'; rp.monthlyDay = o.bymonthday[0] }
  if (o.bymonth) rp.yearlyMonth = Array.isArray(o.bymonth) ? o.bymonth[0] : o.bymonth
  if (o.bymonthday && rp.freq === 'YEARLY') rp.yearlyDay = Array.isArray(o.bymonthday) ? o.bymonthday[0] : o.bymonthday
  if (o.count) { rp.endMode = 'count'; rp.count = o.count }
  else if (o.until) { rp.endMode = 'until'; rp.until = o.until.toISOString().slice(0, 10) }
}

// ── Build rrule ────────────────────────────────────────────────────
function rpBuildRrule() {
  if (rp.eventType !== 'recurring') return null
  const wm = Object.fromEntries(RP_WD.map((w, i) =>
    [w[0], [RRule.MO,RRule.TU,RRule.WE,RRule.TH,RRule.FR,RRule.SA,RRule.SU][i]]))
  const fm = { DAILY: RRule.DAILY, WEEKLY: RRule.WEEKLY, MONTHLY: RRule.MONTHLY, YEARLY: RRule.YEARLY }
  const startVal = document.getElementById('f-start_date')?.value
  const dtstart = startVal ? new Date(startVal + 'T12:00:00Z') : new Date()

  const opts = { freq: fm[rp.freq], interval: rp.interval, dtstart }

  if (rp.freq === 'WEEKLY') {
    opts.byweekday = rp.days.map(d => wm[d])
  } else if (rp.freq === 'MONTHLY') {
    if (rp.monthlyMode === 'weekday') opts.byweekday = [wm[rp.monthlyWeekday].nth(rp.monthlyPos)]
    else opts.bymonthday = [rp.monthlyDay]
  } else if (rp.freq === 'YEARLY') {
    opts.bymonth = [rp.yearlyMonth]; opts.bymonthday = [rp.yearlyDay]
  }

  if (rp.endMode === 'count') opts.count = rp.count
  else if (rp.endMode === 'until' && rp.until) opts.until = new Date(rp.until + 'T23:59:59Z')

  return new RRule(opts)
}

// ── Natural language summary ───────────────────────────────────────
function rpSummary() {
  if (rp.eventType === 'one_off') return 'One-off event'
  const wdn = Object.fromEntries(RP_WD.map(w => [w[0], w[2]]))
  const ord = { 1:'1st', 2:'2nd', 3:'3rd', 4:'4th', [-1]:'last' }
  let s = ''
  if (rp.freq === 'DAILY') {
    s = rp.interval === 1 ? 'Every day' : `Every ${rp.interval} days`
  } else if (rp.freq === 'WEEKLY') {
    const names = rp.days.map(d => wdn[d])
    const dayStr = names.length === 1 ? names[0]
      : names.slice(0, -1).join(', ') + ' and ' + names.at(-1)
    s = rp.interval === 1 ? `Every ${dayStr}` : `Every ${rp.interval} weeks on ${dayStr}`
  } else if (rp.freq === 'MONTHLY') {
    const o = ord[rp.monthlyPos] || rp.monthlyPos + 'th'
    s = rp.monthlyMode === 'weekday'
      ? `Monthly on the ${o} ${wdn[rp.monthlyWeekday]}`
      : `Monthly on the ${ord[rp.monthlyDay] || rp.monthlyDay + 'th'}`
    if (rp.interval > 1) s = `Every ${rp.interval} months: ` + s.replace('Monthly on the ', '')
  } else if (rp.freq === 'YEARLY') {
    s = `Every year on ${RP_MONTHS[rp.yearlyMonth - 1]} ${rp.yearlyDay}`
  }
  if (rp.termTime) s += ', term time only'
  if (rp.endMode === 'count') s += `, ending after ${rp.count} occurrence${rp.count === 1 ? '' : 's'}`
  else if (rp.endMode === 'until' && rp.until)
    s += `, ending on ${new Date(rp.until + 'T12:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}`
  return s
}

// ── Next dates preview ─────────────────────────────────────────────
function rpNextDates() {
  try { return rpBuildRrule()?.all((_, i) => i < 10) || [] }
  catch { return [] }
}

// ── Render ─────────────────────────────────────────────────────────
function rpRender() {
  const el = document.getElementById('rp-container')
  if (el) el.innerHTML = _rpHTML()
}

function _rpHTML() {
  const chip = (label, active, fn) =>
    `<span class="chip-opt${active ? ' active' : ''}" onclick="${fn}">${label}</span>`

  const sel = (opts, fn) =>
    `<select onchange="${fn}" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px;outline:none;background:#fff">${opts}</select>`

  const num = (v, fn, min = 1, max = 99) =>
    `<input type="number" value="${v}" min="${min}" max="${max}" onchange="${fn}" style="width:60px;padding:7px 8px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px;outline:none;text-align:center">`

  const radio = (name, val, checked, fn, content) =>
    `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;flex-wrap:wrap">
      <input type="radio" name="${name}" value="${val}" ${checked ? 'checked' : ''} onchange="${fn}" style="width:15px;height:15px;accent-color:var(--teal-dark);flex-shrink:0">
      ${content}
    </label>`

  if (rp.eventType !== 'recurring') {
    return _rpPreview()
  }

  // Freq chips
  const freqRow = `<div class="field" style="margin-bottom:14px">
    <label>Repeats</label>
    <div class="chips-field">
      ${['DAILY','WEEKLY','MONTHLY','YEARLY'].map(f =>
        chip(f.charAt(0) + f.slice(1).toLowerCase(), rp.freq === f, `rpSetFreq('${f}')`)).join('')}
    </div>
  </div>`

  // Pattern rows
  let pattern = ''
  if (rp.freq === 'DAILY') {
    pattern = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <span style="font-size:13px">Every</span>
      ${num(rp.interval, 'rpSetInterval(this.value)', 1, 30)}
      <span style="font-size:13px">day(s)</span>
    </div>`
  } else if (rp.freq === 'WEEKLY') {
    pattern = `<div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
        <span style="font-size:13px">Every</span>
        ${num(rp.interval, 'rpSetInterval(this.value)', 1, 12)}
        <span style="font-size:13px">week(s) on</span>
      </div>
      <div class="chips-field">
        ${RP_WD.map(w => chip(w[1], rp.days.includes(w[0]), `rpToggleDay('${w[0]}')`)).join('')}
      </div>
    </div>`
  } else if (rp.freq === 'MONTHLY') {
    const ordOpts = RP_ORD.map(([v, l]) => `<option value="${v}" ${rp.monthlyPos == v ? 'selected' : ''}>${l}</option>`).join('')
    const wdOpts  = RP_WD.map(w => `<option value="${w[0]}" ${rp.monthlyWeekday === w[0] ? 'selected' : ''}>${w[2]}</option>`).join('')
    const dayOpts = Array.from({ length: 31 }, (_, i) => i + 1)
      .map(d => `<option value="${d}" ${rp.monthlyDay === d ? 'selected' : ''}>${d}</option>`).join('')
    pattern = `<div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <span style="font-size:13px">Every</span>
        ${num(rp.interval, 'rpSetInterval(this.value)', 1, 12)}
        <span style="font-size:13px">month(s)</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${radio('rp-mon', 'weekday', rp.monthlyMode === 'weekday', "rpSetMonthlyMode('weekday')",
          `On the ${sel(ordOpts, 'rpSetMonthlyPos(this.value)')} ${sel(wdOpts, 'rpSetMonthlyWeekday(this.value)')}`)}
        ${radio('rp-mon', 'day', rp.monthlyMode === 'day', "rpSetMonthlyMode('day')",
          `On day ${sel(dayOpts, 'rpSetMonthlyDay(this.value)')} of the month`)}
      </div>
    </div>`
  } else if (rp.freq === 'YEARLY') {
    const mOpts  = RP_MONTHS.map((m, i) => `<option value="${i + 1}" ${rp.yearlyMonth === i + 1 ? 'selected' : ''}>${m}</option>`).join('')
    const ydOpts = Array.from({ length: 31 }, (_, i) => i + 1)
      .map(d => `<option value="${d}" ${rp.yearlyDay === d ? 'selected' : ''}>${d}</option>`).join('')
    pattern = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <span style="font-size:13px">Every year on</span>
      ${sel(mOpts, 'rpSetYearlyMonth(this.value)')}
      ${sel(ydOpts, 'rpSetYearlyDay(this.value)')}
    </div>`
  }

  // End
  const endRow = `<div class="field" style="margin-bottom:14px">
    <label>Ends</label>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${radio('rp-end', 'never', rp.endMode === 'never', "rpSetEndMode('never')", 'Never')}
      ${radio('rp-end', 'count', rp.endMode === 'count', "rpSetEndMode('count')",
        `After ${num(rp.count, 'rpSetCount(this.value)', 1, 500)} occurrences`)}
      ${radio('rp-end', 'until', rp.endMode === 'until', "rpSetEndMode('until')",
        `On date <input type="date" value="${rp.until}" onchange="rpSetUntil(this.value)" style="padding:6px 10px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px;outline:none;margin-left:4px">`)}
    </div>
  </div>`

  // Term time
  const termRow = `<div style="margin-bottom:4px">
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
      <input type="checkbox" ${rp.termTime ? 'checked' : ''} onchange="rpToggleTermTime(this.checked)" style="width:16px;height:16px;accent-color:var(--teal-dark)">
      <span style="font-size:13px;font-weight:600">Term time only</span>
    </label>
    <p class="field-hint" style="margin-left:26px">Automatically skips school holiday periods</p>
  </div>`

  return freqRow + pattern + endRow + termRow + _rpPreview()
}

function _rpPreview() {
  const summary = rpSummary()
  const dates = rpNextDates()
  const datesHtml = dates.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${dates.map(d =>
        `<span style="background:#e0f2f1;border-radius:99px;padding:3px 10px;font-size:11px;font-weight:600;color:#006a62">${
          d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })
        }</span>`).join('')}</div>`
    : dates.length === 0 && rp.eventType === 'recurring'
      ? `<p style="font-size:11px;color:var(--on-variant);margin-top:6px">Set a start date above to preview occurrences</p>`
      : ''
  return `<div style="background:var(--surface-low);border-radius:var(--r-sm);padding:14px 16px;margin-top:12px">
    <div style="font-size:12px;font-weight:700;color:var(--teal-dark)">${summary}</div>
    ${datesHtml}
  </div>`
}

// ── Handlers ───────────────────────────────────────────────────────
function rpSetFreq(f) { rp.freq = f; rpRender() }
function rpSetInterval(v) { rp.interval = Math.max(1, parseInt(v) || 1); rpRender() }
function rpToggleDay(d) {
  if (rp.days.includes(d)) { if (rp.days.length > 1) rp.days = rp.days.filter(x => x !== d) }
  else rp.days = [...rp.days, d].sort((a, b) =>
    ['MO','TU','WE','TH','FR','SA','SU'].indexOf(a) - ['MO','TU','WE','TH','FR','SA','SU'].indexOf(b))
  rpRender()
}
function rpSetMonthlyMode(m) { rp.monthlyMode = m; rpRender() }
function rpSetMonthlyPos(v) { rp.monthlyPos = parseInt(v); rpRender() }
function rpSetMonthlyWeekday(v) { rp.monthlyWeekday = v; rpRender() }
function rpSetMonthlyDay(v) { rp.monthlyDay = parseInt(v); rpRender() }
function rpSetYearlyMonth(v) { rp.yearlyMonth = parseInt(v); rpRender() }
function rpSetYearlyDay(v) { rp.yearlyDay = parseInt(v); rpRender() }
function rpSetEndMode(m) { rp.endMode = m; rpRender() }
function rpSetCount(v) { rp.count = Math.max(1, parseInt(v) || 1); rpRender() }
function rpSetUntil(v) { rp.until = v; rpRender() }
function rpToggleTermTime(v) { rp.termTime = !!v; rpRender() }

function rpSetEventType(type) {
  rp.eventType = type
  const hidden = document.getElementById('f-event_type')
  if (hidden) hidden.value = type
  const oneOff = document.getElementById('class-one-off-section')
  if (oneOff) oneOff.style.display = type === 'one_off' ? '' : 'none'
  const startDate = document.getElementById('class-start-section')
  if (startDate) startDate.style.display = type === 'recurring' ? '' : 'none'
  document.querySelectorAll('[data-et]').forEach(c =>
    c.classList.toggle('active', c.dataset.et === type))
  rpRender()
}

// ── Get values for saving ──────────────────────────────────────────
function rpGetValues() {
  if (rp.eventType === 'one_off') {
    return { event_type: 'one_off', rrule_string: null, day_of_week: null, recurrence: null,
             start_date: document.getElementById('f-one-off-date')?.value || null,
             end_date: null }
  }
  const rule = rpBuildRrule()
  const rrule_string = rule?.toString() || null
  const wdn = Object.fromEntries(RP_WD.map(w => [w[0], w[2]]))
  let day_of_week = null, recurrence = null
  if (rp.freq === 'WEEKLY') {
    day_of_week = rp.days.length === 1 ? wdn[rp.days[0]] : null
    recurrence  = rp.interval === 2 ? 'fortnightly' : 'weekly'
  } else if (rp.freq === 'MONTHLY' && rp.monthlyMode === 'weekday') {
    day_of_week = wdn[rp.monthlyWeekday]
    recurrence  = `monthly-${Math.max(1, Math.min(4, rp.monthlyPos))}`
  }
  return {
    event_type: 'recurring', rrule_string, day_of_week, recurrence,
    start_date: document.getElementById('f-start_date')?.value || null,
    end_date:   rp.endMode === 'until' ? rp.until : null,
  }
}
