"""Attachment scan coverage is independent of research-text ingestion coverage."""
from build_daily_report import stamp


def scan_updated_after_four(scan, cutoff):
    """User policy from 2026-10-23: a same-day scan after 16:00 permits publication.

    This does not assert complete window coverage or change the receipt.
    """
    observed = stamp((scan or {}).get('observedAt'))
    return bool(cutoff and cutoff.date().isoformat() >= '2026-10-23'
                and observed and observed.date() == cutoff.date()
                and observed.hour >= 16)


def attachment_catalog(library, start, cutoff):
    scan = library.get('attachmentScan') or {}
    lower, upper = stamp(scan.get('windowStart')), stamp(scan.get('windowEnd'))
    observed = stamp(scan.get('observedAt'))
    def valid_interval(s):
        lo, hi, at = stamp(s.get('windowStart')), stamp(s.get('windowEnd')), stamp(s.get('observedAt'))
        if (lo and hi and at and hi >= lo and at >= hi
                and s.get('windowComplete') is True and s.get('boundaryReachedBeforeWindow') is True
                and isinstance(s.get('topicPages'), int) and s['topicPages'] > 0):
            return lo, hi
    scans = library.get('attachmentScans') or [scan]
    intervals = sorted(x for s in scans if (x := valid_interval(s)))
    cursor = start
    gaps = []
    for lo, hi in intervals:
        if hi <= cursor or lo >= cutoff: continue
        if lo > cursor: gaps.append({'start': cursor.isoformat(), 'end': min(lo, cutoff).isoformat()})
        cursor = min(cutoff, max(cursor, hi))
    if cursor < cutoff: gaps.append({'start': cursor.isoformat(), 'end': cutoff.isoformat()})
    complete = not gaps
    result = {'generatedAt': library.get('generatedAt'),
            'sourceThrough': library.get('coverage', {}).get('to'),
            'scan': scan, 'coverageStatus': 'complete' if complete else 'pending',
            'requestedWindowStart': start.isoformat(), 'requestedCutoff': cutoff.isoformat()}
    if library.get('attachmentScans'):
        selected = []
        cursor = start
        while cursor < cutoff:
            candidates = [(s, valid_interval(s)) for s in scans if valid_interval(s)]
            candidates = [(s, interval) for s, interval in candidates if interval[0] <= cursor < interval[1]]
            if not candidates: break
            chosen, interval = max(candidates, key=lambda x: (x[1][1], not bool(x[0].get('receiptFile')), str(x[0].get('receiptFile', ''))))
            selected.append(chosen)
            cursor = interval[1]
        result['coverageScans'] = selected if complete else scans
    if gaps: result['missingIntervals'] = gaps
    if cutoff.date().isoformat() >= '2026-10-23':
        result['publicationEligibility'] = {
            'policy': 'scan-observed-after-16',
            'eligible': complete or scan_updated_after_four(scan, cutoff),
            'scanObservedAt': scan.get('observedAt'),
            'coverageComplete': complete}
    return result


def validate_attachment_coverage(resources):
    catalog = resources.get('attachmentCatalog') or {}
    expected = attachment_catalog({'generatedAt': catalog.get('generatedAt'),
                                   'coverage': {'to': catalog.get('sourceThrough')},
                                   'attachmentScan': catalog.get('scan'),
                                   'attachmentScans': catalog.get('coverageScans')},
                                  stamp(resources['windowStart']), stamp(resources['cutoff']))
    assert (expected['coverageStatus'] == 'complete'
            or scan_updated_after_four(catalog.get('scan'), stamp(resources['cutoff']))), (
                'Attachment scan must cover the daily window or be updated after 16:00 on the report date')

