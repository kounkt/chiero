"""Validate the current multi-page corporate site. Run after release generation.
Replaces checks tied to the retired single-page design; no network or mutations.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit,unquote
import json,re,sys
ROOT=Path(__file__).resolve().parent.parent
CORE=['','works/','books/','about/','press/','journal/','contact/','free/','interviews/']
class Page(HTMLParser):
 def __init__(self,text):
  super().__init__();self.tags=[];self.feed(text);self.text=text
 def handle_starttag(self,tag,attrs):self.tags.append((tag,dict(attrs)))
 def attrs(self,tag):return [a for t,a in self.tags if t==tag]
 def meta(self,name):return next((a.get('content') for a in self.attrs('meta') if a.get('name',a.get('property'))==name),None)
 def links(self,rel):return [a for a in self.attrs('link') if a.get('rel')==rel]
 def count_class(self,name):return sum(name in a.get('class','').split() for _,a in self.tags)
 def ids(self):return [a['id'] for _,a in self.tags if a.get('id')]
# Leak scan: every git-tracked file is public (GitHub Pages serves the repo root).
# Generic patterns live here; site-specific internal names live in tools/leak_patterns.local.json (git-ignored).
import subprocess
PATH_PATTERNS=['/Users/','/home/','C:\\Users\\']
COMMENT_WORDS=['TODO','FIXME']
TEXT_EXT={'.html','.md','.py','.sh','.plist','.json','.txt','.xml','.js','.css','.yml','.yaml','.svg','.csv'}
INTERNAL_FILE=re.compile(r'(^|/)(README[^/]*\.md|HOWTO[^/]*\.md|[^/]*\.bak[^/]*|\.DS_Store|[^/]*\.psd)$',re.I)
COMMENT_RE=re.compile(r'<!--(.*?)-->',re.S)
COND_RE=re.compile(r'\s*\[if |\s*<!\[endif|\[endif')
LICENSE_RE=re.compile(r'license|licence|copyright|MIT|SPDX',re.I)
def load_local():
 f=ROOT/'tools/leak_patterns.local.json'
 if not f.exists():return [],[],False
 d=json.loads(f.read_text());return d.get('paths',[]),d.get('comment_words',[]),True
def tracked():
 out=subprocess.run(['git','-C',str(ROOT),'ls-files','-z'],capture_output=True).stdout.decode('utf-8','replace')
 return [x for x in out.split('\0') if x]
def leak_scan():
 """Returns (hits, internal_files, has_local). Paths: all tracked text files. Words: inside <!-- --> of .html only."""
 lp,lw,has=load_local();paths=PATH_PATTERNS+lp;words=COMMENT_WORDS+lw
 hits=[];internal=[]
 for rel in tracked():
  f=ROOT/rel
  if INTERNAL_FILE.search(rel):internal.append(rel)
  if f.suffix.lower() not in TEXT_EXT or rel=='tools/consistency.py' or not f.is_file():continue
  try:s=f.read_text(errors='replace')
  except OSError:continue
  for i,line in enumerate(s.split('\n'),1):
   for w in paths:
    if w in line:
     k=line.index(w);hits.append((rel,i,w,line[max(0,k-40):k+40].strip()))
  if f.suffix.lower()!='.html':continue
  for m in COMMENT_RE.finditer(s):
   body=m.group(1)
   if COND_RE.match(body) or body.strip().startswith('/') or LICENSE_RE.search(body):continue
   for w in words:
    if w in body:
     k=body.index(w);ln=s.count('\n',0,m.start(1))+body.count('\n',0,k)+1
     hits.append((rel,ln,w,body[max(0,k-40):k+40].replace('\n',' ').strip()))
 return hits,internal,has
def verify():
 errors=[];checks=0
 def check(ok,label):
  nonlocal checks;checks+=1
  if not ok:errors.append(label)
 for lang in ('ja','en'):
  for path in CORE:
   rel=('en/' if lang=='en' else '')+path;f=ROOT/rel/'index.html';s=f.read_text();p=Page(s);url='https://chiero.jp/'+rel
   check(len(p.attrs('html'))==1 and p.attrs('html')[0].get('lang')==lang,rel+' document/language')
   check(len(p.attrs('h1'))==1 and len(p.ids())==len(set(p.ids())),rel+' H1 / duplicate IDs')
   check([x.get('href') for x in p.links('canonical')]==[url] and p.meta('robots')=='index,follow',rel+' canonical/robots')
   check(p.meta('og:url')==url and p.meta('og:locale')==('en_US' if lang=='en' else 'ja_JP'),rel+' OG URL/locale')
   check(p.meta('twitter:card')=='summary_large_image',rel+' sharing card')
   check(not re.search(r'@[A-Z_:]+@',s),rel+' template tokens')
   check(s.count('static.cloudflareinsights.com/beacon.min.js')==1 and '87c0b3b3197c484598ee1d3d073b56df' in s,rel+' analytics')
   check(not any(x in s for x in ['googletagmanager.com','google-analytics.com','connect.facebook.net','birthDate','7290001091210','1993']),rel+' unrequested tracking/private facts')
   for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>',s,re.S):
    try:json.loads(block)
    except ValueError:errors.append(rel+' invalid JSON-LD')
   for tag,a in p.tags:
    ref=a.get('href') if tag in ('a','link') else a.get('src') if tag in ('img','script') else None
    if not ref:continue
    u=urlsplit(ref)
    if u.scheme not in ('','https','http') or (u.netloc and u.netloc!='chiero.jp'):continue
    target=(ROOT/unquote(u.path.lstrip('/'))) if u.path.startswith('/') or u.netloc else f.parent/unquote(u.path)
    if not u.path:target=f
    elif target.is_dir():target=target/'index.html'
    check(target.is_file(),rel+' missing target '+ref)
    if u.fragment and target.suffix=='.html' and target.is_file():check(unquote(u.fragment) in Page(target.read_text()).ids(),rel+' missing anchor '+ref)
   card=urlsplit(p.meta('og:image') or '').path
   check(bool(card) and (ROOT/card.lstrip('/')).is_file(),rel+' social image file')
 # Full app descriptions live in the directory; the homepage links to it.
 for rel in ('works/index.html','en/works/index.html'):
  s=(ROOT/rel).read_text();p=Page(s);atlas=re.search(r'<article class="app-card" id="relationship-atlas">.*?</article>',s,re.S)
  check(p.count_class('app-card')==3 and 'https://hodoku.chiero.jp/' in s and 'https://sonosaki.chiero.jp/' in s,rel+' released app catalog')
  check(bool(atlas) and any(urlsplit(a.get('href','')).netloc=='zukan.chiero.jp' for a in Page(atlas[0]).attrs('a')) and bool(re.search(r'<h3>.+?</h3>',atlas[0],re.S)) and not any(t in atlas[0] for t in ('公開予定','COMING SOON','IN DEVELOPMENT','人間関係図鑑')),rel+' released Relationship Atlas name and launch link')
 for rel in ('index.html','en/index.html'):
  s=(ROOT/rel).read_text();hero=s.split('<div class="hero-art"')[0]
  # 2026-10-03: the free feature pointed to the ChatGPT course seminar; after the UTAGE exit it points to the recorded seminar embedded on /skills/ (the workbook stays reachable from /free/).
  check('workbook/' not in hero and 'home-free-cover' in s and 'https://chiero.jp/skills/#seminar' in s.split('id="free"')[1].split('</section>')[0],rel+' free feature points to the recorded seminar on /skills/')
 check('Cloudflare Web Analytics' in (ROOT/'privacy/index.html').read_text(),'privacy disclosure')
 check((ROOT/'index.html').read_text().count('<!-- NOTE:START')==1 and (ROOT/'index.html').read_text().count('<!-- NOTE:END -->')==1,'note feed markers')
 check(not list((ROOT/'assets/renewal').glob('*.pdf')),'gated PDF stays private')
 for filename in ['llms.txt','en/llms.txt','en/ai-prompt.txt']:
  s=(ROOT/filename).read_text();check('Turning tilt into structure' not in s and 'numberOfEmployees' not in s and 'No employees' not in s and '7290001091210' not in s,filename+' current public context')
 hits,internal,has=leak_scan()
 check(not hits,'public files leak internal text: %d hits'%len(hits))
 for h in hits:errors.append('LEAK %s:%d [%s] %s'%h)
 if not has:print('WARN: tools/leak_patterns.local.json not found; only generic patterns were checked')
 for r in internal:print('WARN: internal-looking file in public tree:',r)
 print(f'{checks} checks; {len(errors)} failures')
 for error in errors:print('FAIL:',error)
 return bool(errors)
if __name__=='__main__':sys.exit(verify())
