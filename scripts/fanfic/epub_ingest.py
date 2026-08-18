#!/usr/bin/env python3
"""EPUB -> local canon source pack, using only Python stdlib.

No source text is copied into the plugin package. Run this locally against a user-owned EPUB.
"""
from __future__ import annotations
import argparse, hashlib, html, json, re, sys, zipfile
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
import xml.etree.ElementTree as ET

class TextExtractor(HTMLParser):
    BLOCKS = {'p','div','h1','h2','h3','h4','h5','h6','li','br','section','article'}
    SKIP = {'style','script','svg'}
    def __init__(self):
        super().__init__(convert_charrefs=True); self.parts=[]; self.depth_skip=0; self.headings=[]; self._heading=None
    def handle_starttag(self, tag, attrs):
        tag=tag.lower()
        if tag in self.SKIP: self.depth_skip += 1
        if self.depth_skip: return
        if tag in self.BLOCKS: self.parts.append('\n')
        if tag in {'h1','h2','h3'}: self._heading=[]
    def handle_endtag(self, tag):
        tag=tag.lower()
        if tag in self.SKIP and self.depth_skip: self.depth_skip -= 1; return
        if self.depth_skip: return
        if tag in {'h1','h2','h3'} and self._heading is not None:
            t=''.join(self._heading).strip()
            if t: self.headings.append(t)
            self._heading=None
        if tag in self.BLOCKS: self.parts.append('\n')
    def handle_data(self, data):
        if self.depth_skip: return
        self.parts.append(data)
        if self._heading is not None: self._heading.append(data)
    def result(self):
        text=''.join(self.parts).replace('\u00a0',' ')
        text=re.sub(r'[ \t]+',' ',text)
        text=re.sub(r'\n\s*\n+', '\n', text)
        return text.strip(), (self.headings[0] if self.headings else '')

def sha256_bytes(b:bytes)->str: return hashlib.sha256(b).hexdigest()
def localname(tag:str)->str: return tag.rsplit('}',1)[-1]

def find_container_opf(z:zipfile.ZipFile)->str:
    data=z.read('META-INF/container.xml')
    root=ET.fromstring(data)
    for e in root.iter():
        if localname(e.tag)=='rootfile' and e.attrib.get('full-path'): return e.attrib['full-path']
    raise RuntimeError('EPUB container.xml has no rootfile/full-path')

def parse_opf(z, opf_path):
    root=ET.fromstring(z.read(opf_path))
    manifest={}; spine=[]; title=''; creator=''
    for e in root.iter():
        ln=localname(e.tag)
        if ln=='item': manifest[e.attrib.get('id','')] = e.attrib
        elif ln=='itemref' and e.attrib.get('idref'): spine.append(e.attrib['idref'])
        elif ln=='title' and not title: title=''.join(e.itertext()).strip()
        elif ln=='creator' and not creator: creator=''.join(e.itertext()).strip()
    return manifest, spine, title, creator

def resolve_href(opf_path, href):
    return str(PurePosixPath(opf_path).parent.joinpath(PurePosixPath(href)))

def infer_part(href, title):
    m=re.search(r'part-([^-_/]+)-ch', href, flags=re.I)
    if m: return m.group(1)
    m=re.search(r'第([一二三四五六七八九十百零〇0-9]+)卷', title)
    return m.group(1) if m else None

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('epub', type=Path)
    ap.add_argument('out_dir', type=Path)
    ap.add_argument('--include-non-chapters', action='store_true')
    args=ap.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    epub_bytes=args.epub.read_bytes()
    epub_hash=sha256_bytes(epub_bytes)
    chapters=[]
    with zipfile.ZipFile(args.epub) as z:
        opf=find_container_opf(z)
        manifest, spine, title, creator=parse_opf(z, opf)
        # Some community EPUBs leave dc:creator empty but identify the author in an introduction page.
        if not creator:
            for item in manifest.values():
                href=item.get('href','')
                if 'intro' not in href.lower() and 'introduction' not in href.lower():
                    continue
                try:
                    full_intro=resolve_href(opf, href)
                    raw_intro=z.read(full_intro)
                    parser_intro=TextExtractor(); parser_intro.feed(raw_intro.decode('utf-8', errors='replace'))
                    intro_text,_=parser_intro.result()
                    m_author=re.search(r'作者\s*[:：]\s*([^\n]+)', intro_text)
                    if m_author:
                        creator=m_author.group(1).strip(); break
                except Exception:
                    pass
        for spine_i, idref in enumerate(spine, start=1):
            item=manifest.get(idref)
            if not item: continue
            media=item.get('media-type','')
            href=item.get('href','')
            if 'html' not in media and not href.lower().endswith(('.html','.xhtml','.htm')): continue
            full=resolve_href(opf, href)
            if not args.include_non_chapters and not re.search(r'(?:^|/)part-[^/]+-ch\d+\.(?:x?html?)$', full, flags=re.I):
                continue
            raw=z.read(full)
            enc='utf-8'
            m=re.search(br'charset=["\']?([A-Za-z0-9._-]+)', raw[:500], flags=re.I)
            if m:
                try: enc=m.group(1).decode('ascii')
                except Exception: pass
            try: text_raw=raw.decode(enc, errors='replace')
            except LookupError: text_raw=raw.decode('utf-8', errors='replace')
            parser=TextExtractor(); parser.feed(text_raw)
            text, heading=parser.result()
            if not heading:
                lines=[x.strip() for x in text.splitlines() if x.strip()]
                heading=lines[0] if lines else PurePosixPath(full).stem
            chapters.append({
                'index': len(chapters)+1,
                'spineIndex': spine_i,
                'title': heading,
                'part': infer_part(full, heading),
                'href': full,
                'sha256': sha256_bytes(raw),
                'text': text,
            })
    source={
        'format':'epub','fileName':args.epub.name,'sha256':epub_hash,
        'title':title,'creator':creator,'opf':opf,
        'chapterCount':len(chapters),
    }
    manifest_out={
        'schemaVersion':1,'canonPackId': re.sub(r'[^a-zA-Z0-9._-]+','-', (title or args.epub.stem)).strip('-') or 'canon-pack',
        'source': {'sha256':epub_hash,'title':title,'creator':creator},
        'narrativeIndex': {'kind':'epub-spine','chapterCount':len(chapters)},
        'graphVersion':0,
    }
    (args.out_dir/'source.json').write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (args.out_dir/'manifest.json').write_text(json.dumps(manifest_out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    with (args.out_dir/'chapters.ndjson').open('w',encoding='utf-8') as f:
        for ch in chapters: f.write(json.dumps(ch,ensure_ascii=False,separators=(',',':'))+'\n')
    (args.out_dir/'graph').mkdir(exist_ok=True)
    for name in ('facts.ndjson','knowledge.ndjson','characters.ndjson','identities.ndjson','powers.ndjson','relationships.ndjson','mysteries.ndjson','events.ndjson'):
        p=args.out_dir/'graph'/name
        if not p.exists(): p.write_text('',encoding='utf-8')
    print(json.dumps({'ok':True,'out':str(args.out_dir),'source':source},ensure_ascii=False,indent=2))
if __name__=='__main__': main()
