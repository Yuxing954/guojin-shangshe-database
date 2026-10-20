"""Fail-closed classification for prebuilt duty-free-only data pushes."""
import argparse,re,subprocess
ALLOWED={'data/dutyfree_monthly.csv','data-manifest.json','data/industry/overview.json','data/dutyfree/monthly-provenance.json','data/dutyfree/monthly-calculations.json','data/dutyfree/overview.json','data/dutyfree/hainan.json','data/dutyfree/manifest.json','data/dutyfree/sources.json'}
def dutyfree_only(paths):
    paths=set(paths)
    return bool(paths) and {'data/dutyfree_monthly.csv','data/industry/overview.json'}<=paths and any(re.fullmatch(r'data/industry/miaoxiang-\d{4}-\d{2}-\d{2}-dutyfree(?:-\d{4}-\d{2})?\.json',p) for p in paths) and all(p in ALLOWED or re.fullmatch(r'data/industry/miaoxiang-\d{4}-\d{2}-\d{2}-dutyfree(?:-\d{4}-\d{2})?\.json',p) for p in paths)
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--base',default='');ap.add_argument('--head',default='');a=ap.parse_args()
    if not all(re.fullmatch(r'[a-f0-9]{40}',v) and set(v)!={'0'} for v in [a.base,a.head]):print('false');return
    try:paths=subprocess.run(['git','diff','--name-only',a.base,a.head],check=True,capture_output=True,text=True).stdout.splitlines()
    except (OSError,subprocess.SubprocessError):print('false');return
    print('true' if dutyfree_only(paths) else 'false')
if __name__=='__main__':main()

