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
 for rel in ('index.html','works/index.html','en/index.html','en/works/index.html'):
  s=(ROOT/rel).read_text();p=Page(s);atlas=re.search(r'<article class="app-card" id="relationship-atlas">.*?</article>',s,re.S)
  check(p.count_class('app-card')==3 and 'https://hodoku.chiero.jp/' in s and 'https://sonosaki.chiero.jp/' in s,rel+' released app catalog')
  check(bool(atlas) and any(urlsplit(a.get('href','')).netloc=='zukan.chiero.jp' for a in Page(atlas[0]).attrs('a')) and bool(re.search(r'<h3>.+?</h3>',atlas[0],re.S)) and not any(t in atlas[0] for t in ('公開予定','COMING SOON','IN DEVELOPMENT','人間関係図鑑')),rel+' released Relationship Atlas name and launch link')
 for rel in ('index.html','en/index.html'):
  s=(ROOT/rel).read_text();hero=s.split('<div class="hero-art"')[0]
  check('workbook/' not in hero and 'home-free-cover' in s and 'workbook/' in s,rel+' workbook only in illustrated feature')
 check('Cloudflare Web Analytics' in (ROOT/'privacy/index.html').read_text(),'privacy disclosure')
 check((ROOT/'index.html').read_text().count('<!-- NOTE:START')==1 and (ROOT/'index.html').read_text().count('<!-- NOTE:END -->')==1,'note feed markers')
 check(not list((ROOT/'assets/renewal').glob('*.pdf')),'gated PDF stays private')
 for filename in ['llms.txt','en/llms.txt','en/ai-prompt.txt']:
  s=(ROOT/filename).read_text();check('Turning tilt into structure' not in s and 'numberOfEmployees' not in s and 'No employees' not in s and '7290001091210' not in s,filename+' current public context')
 print(f'{checks} checks; {len(errors)} failures')
 for error in errors:print('FAIL:',error)
 return bool(errors)
if __name__=='__main__':sys.exit(verify())
