"""JA/EN parity for the current corporate pages, without freezing retired copy."""
from consistency import ROOT,CORE,Page
import re,sys
errors=[];checks=0
def check(ok,label):
 global checks;checks+=1
 if not ok:errors.append(label)
for path in CORE:
 ja=Page((ROOT/path/'index.html').read_text());en=Page((ROOT/'en'/path/'index.html').read_text())
 for lang,p in [('ja',ja),('en',en)]:
  expected={'ja':'https://chiero.jp/'+path,'en':'https://chiero.jp/en/'+path,'x-default':'https://chiero.jp/'+path}
  check({a.get('hreflang'):a.get('href') for a in p.links('alternate')}==expected,path+lang+' reciprocal hreflang')
  switches=[a for a in p.attrs('a') if 'language-switch' in a.get('class','').split()]
  check(len(switches)==1 and switches[0]['href']==expected['en' if lang=='ja' else 'ja'],path+lang+' same-page language switch')
  header=p.text.split('</header>')[0]
  check(header.find('class="language-switch"')>header.find('</nav>'),path+lang+' language switch outside hidden nav')
  check(p.count_class('corporate-site')==1 and '/assets/renewal/site.css?' in p.text,path+lang+' shared design')
 for cls in ['activity-card','app-card','book-cover','contact-row','follower-breakdown']:check(ja.count_class(cls)==en.count_class(cls),path+' translated '+cls)
 for slug in ['hodoku','sonosaki','relationship-atlas','social','company','metrics','television','press-contact','prefectures']:check((slug in ja.ids())==(slug in en.ids()),path+' anchor '+slug)
 if path=='interviews/':
  for lang,p in [('ja',ja),('en',en)]:check(sum('data-prefecture' in a for _,a in p.tags)==47,lang+' 47 prefectures')
  get=lambda p:{a['href'] for a in p.attrs('a') if '/@chiero_piero/post/' in a.get('href','')}
  check(get(ja)==get(en),'same published prefecture links')
 if path=='about/':
  years=lambda p:re.findall(r'<li><span>(\d{4})</span>',p.text)
  check(years(ja)==years(en) and len(years(en))==6,'timeline parity')
 if path=='press/':check('10,723,259' in ja.text and '10,723,259' in en.text,'Threads metric parity')
 check('Japanese' in en.text,path+' Japanese destinations explained')
 check('kounkt.github.io' not in en.text and 'Turning tilt into structure' not in en.text,path+' no stale English references')
 check('https://chiero.jp/en/'+path in (ROOT/'sitemap.xml').read_text(),path+' English sitemap')
print(f'{checks} bilingual checks; {len(errors)} failures')
for error in errors:print('FAIL:',error)
sys.exit(bool(errors))
