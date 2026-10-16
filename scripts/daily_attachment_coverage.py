"""Attachment scan coverage is independent of research-text ingestion coverage."""
from build_daily_report import stamp


def attachment_catalog(library, start, cutoff):
    scan = library.get('attachmentScan') or {}
    lower, upper = stamp(scan.get('windowStart')), stamp(scan.get('windowEnd'))
    observed = stamp(scan.get('observedAt'))
    complete = bool(lower and upper and observed and lower <= start
                    and upper >= cutoff and observed >= upper
                    and scan.get('windowComplete') is True
                    and scan.get('boundaryReachedBeforeWindow') is True
                    and isinstance(scan.get('topicPages'), int)
                    and scan['topicPages'] > 0)
    return {'generatedAt': library.get('generatedAt'),
            'sourceThrough': library.get('coverage', {}).get('to'),
            'scan': scan, 'coverageStatus': 'complete' if complete else 'pending',
            'requestedWindowStart': start.isoformat(), 'requestedCutoff': cutoff.isoformat()}


def validate_attachment_coverage(resources):
    catalog = resources.get('attachmentCatalog') or {}
    expected = attachment_catalog({'generatedAt': catalog.get('generatedAt'),
                                   'coverage': {'to': catalog.get('sourceThrough')},
                                   'attachmentScan': catalog.get('scan')},
                                  stamp(resources['windowStart']), stamp(resources['cutoff']))
    assert expected['coverageStatus'] == 'complete', 'Attachment scan does not cover the complete daily window'
