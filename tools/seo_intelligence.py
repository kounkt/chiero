#!/usr/bin/env python3
"""CHIERO SEO/LLMO crawler -> SQLite. stdlib only.
Crawls canonical HTML URLs from sitemap and stores page text, metadata and internal links.
Optional Search Console CSV import joins query/page metrics without requiring credentials.
"""
import argparse,csv,hashlib,html,re,sqlite3,time,urllib.parse,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
UA='CHIERO-SEO-Intelligence/1.0 (+https://chiero.jp/)'

def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'text/html,application/xhtml+xml'})
 with urllib.request.urlopen(req,timeout=25) as r:return r.status,r.geturl(),r.headers.get('content-type',''),r.read()
def clean(raw):
 s=raw.decode('utf-8','replace'); title=re.search(r'<title[^>]*>(.*?)</title>',s,re.I|re.S); desc=re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)',s,re.I|re.S) or re.search(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']description',s,re.I|re.S); can=re.search(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)',s,re.I|re.S); hs=[re.sub('<[^>]+>',' ',x) for x in re.findall(r'<h([1-3])[^>]*>(.*?)</h\1>',s,re.I|re.S)] if False else []
 h=[]
 for level,body in re.findall(r'<h([1-3])[^>]*>(.*?)</h\1>',s,re.I|re.S): h.append((int(level),re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',body))).strip()))
 links=[html.unescape(x) for x in re.findall(r'<a[^>]+href=["\']([^"\']+)',s,re.I)]
 text=re.sub(r'<script.*?</script>|<style.*?</style>|<noscript.*?</noscript>',' ',s,flags=re.I|re.S); text=re.sub('<[^>]+>',' ',text); text=re.sub(r'\s+',' ',html.unescape(text)).strip()
 return (html.unescape(re.sub('<[^>]+>',' ',title.group(1))).strip() if title else '', html.unescape(desc.group(1)).strip() if desc else '', can.group(1) if can else '',h,links,text)
def db_init(c):
 c.executescript('''CREATE TABLE IF NOT EXISTS pages(url TEXT PRIMARY KEY,status INTEGER,final_url TEXT,content_type TEXT,title TEXT,description TEXT,canonical TEXT,h1 TEXT,h2 TEXT,h3 TEXT,body_text TEXT,body_sha256 TEXT,fetched_at TEXT);CREATE TABLE IF NOT EXISTS links(source_url TEXT,target_url TEXT,anchor TEXT,PRIMARY KEY(source_url,target_url,anchor));CREATE TABLE IF NOT EXISTS search_console(date TEXT,query TEXT,page TEXT,country TEXT,device TEXT,clicks REAL,impressions REAL,ctr REAL,position REAL);CREATE INDEX IF NOT EXISTS idx_sc_page ON search_console(page);CREATE INDEX IF NOT EXISTS idx_sc_query ON search_console(query);''')
def sitemap_urls(url):
 _,_,_,b=fetch(url); root=ET.fromstring(b); return [x.text.strip() for x in root.findall('.//{*}loc') if x.text and x.text.strip().endswith('/')]
def crawl(db,sitemap,host):
 c=sqlite3.connect(db);db_init(c);now=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());urls=sitemap_urls(sitemap);print('urls',len(urls))
 for i,u in enumerate(urls,1):
  try:
   st,final,ct,b=fetch(u);title,desc,can,hs,links,text=clean(b); h={1:[],2:[],3:[]};[h[n].append(v) for n,v in hs];c.execute('REPLACE INTO pages VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',(u,st,final,ct,title,desc,can,' | '.join(h[1]),' | '.join(h[2]),' | '.join(h[3]),text,hashlib.sha256(text.encode()).hexdigest(),now));c.execute('DELETE FROM links WHERE source_url=?',(u,));
   for href in links:
    target=urllib.parse.urljoin(u,href).split('#')[0]
    if urllib.parse.urlparse(target).netloc==host:c.execute('INSERT OR IGNORE INTO links VALUES(?,?,?)',(u,target,''))
   c.commit();print(i,st,u)
  except Exception as e:print(i,'ERROR',u,type(e).__name__,e)
 c.close()
def import_sc(db,path):
 c=sqlite3.connect(db);db_init(c);n=0
 with open(path,encoding='utf-8-sig',newline='') as f:
  for r in csv.DictReader(f):
   def g(*names):
    for n in names:
     if n in r:return r[n]
    return ''
   try:c.execute('INSERT INTO search_console VALUES(?,?,?,?,?,?,?,?,?)',(g('Date','日付'),g('Query','検索キーワード','クエリ'),g('Page','ページ'),g('Country','国'),g('Device','デバイス'),float(g('Clicks','クリック数') or 0),float(g('Impressions','表示回数') or 0),float(str(g('CTR')).replace('%','') or 0),float(g('Position','掲載順位') or 0)));n+=1
   except ValueError:pass
 c.commit();c.close();print('imported',n)
def report(db):
 c=sqlite3.connect(db);print('\nPages:',c.execute('select count(*) from pages').fetchone()[0]);print('Non-200:',c.execute('select count(*) from pages where status!=200').fetchone()[0]);print('Missing description:',c.execute("select count(*) from pages where description='' ").fetchone()[0]);print('Missing H1:',c.execute("select count(*) from pages where h1='' ").fetchone()[0]);print('SC rows:',c.execute('select count(*) from search_console').fetchone()[0]);
 for row in c.execute('select page,sum(clicks),sum(impressions) from search_console group by page order by sum(impressions) desc limit 20'):print(row)
 c.close()
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--db',default='seo.sqlite3');p.add_argument('--sitemap',default='https://chiero.jp/sitemap.xml');p.add_argument('--host',default='chiero.jp');p.add_argument('--import-search-console');p.add_argument('--report',action='store_true');a=p.parse_args();
 if a.import_search_console:import_sc(a.db,a.import_search_console)
 elif a.report:report(a.db)
 else:crawl(a.db,a.sitemap,a.host)
