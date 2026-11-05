"""Prepare one replacement edit without changing or trimming its source file.

Usage: python scripts/prepare_film.py "D:/edits/new-cut.mp4" --stage-at 36
Requires ffmpeg and ffprobe on PATH. Rebuild/publish the Site after preparation.
"""
import argparse, hashlib, json, pathlib, re, subprocess

ROOT=pathlib.Path(__file__).resolve().parents[1]
def probe(path):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)],text=True,encoding='utf-8'))
def run(args):
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','warning','-y',*[v.as_posix() if isinstance(v,pathlib.Path) else str(v) for v in args]],check=True)
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('source',type=pathlib.Path)
    ap.add_argument('--stage-at',required=True,type=float,help='Source time in seconds where the camera starts pulling out of the stage screen')
    ap.add_argument('--output',type=pathlib.Path,default=ROOT/'assets/media/film-hd')
    args=ap.parse_args();source=args.source.resolve();out=args.output.resolve()
    if not source.is_file():raise SystemExit('Source file does not exist')
    if source.is_relative_to(out):raise SystemExit('Keep the original outside the generated segment directory')
    info=probe(source);v=next(s for s in info['streams'] if s['codec_type']=='video');a=next((s for s in info['streams'] if s['codec_type']=='audio'),None)
    duration=float(v.get('duration') or info['format']['duration']);fps_n,fps_d=map(int,v['avg_frame_rate'].split('/'));fps=fps_n/fps_d
    if not 0<=args.stage_at<duration:raise SystemExit('The stage point must fall within the source video')
    out.mkdir(parents=True,exist_ok=True)
    audio=['-c:a','copy'] if a and a['codec_name']=='aac' else ['-c:a','aac','-b:a','256k']
    run(['-i',source,'-map','0:v:0','-map','0:a:0?','-vf','scale=w=min(1920\,iw):h=min(1080\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2','-c:v','libx264','-preset','slow','-crf','19','-maxrate','12M','-bufsize','24M','-pix_fmt','yuv420p','-profile:v','high','-level:v','4.2','-g',round(fps*2),'-keyint_min',round(fps*2),'-sc_threshold','0','-fps_mode','passthrough',*audio,'-f','hls','-hls_time','2','-hls_playlist_type','vod','-hls_flags','independent_segments','-hls_segment_type','fmp4','-hls_fmp4_init_filename','init.mp4','-hls_segment_filename',out/'segment-%03d.m4s',out/'index.m3u8'])
    # A compatible path always belongs to the same replacement edit.
    fallback=out/'compatible.mp4'
    run(['-i',source,'-map','0:v:0','-map','0:a:0?','-vf','scale=w=min(1280\,iw):h=min(720\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2','-c:v','libx264','-preset','slow','-crf','25','-maxrate','3M','-bufsize','6M','-pix_fmt','yuv420p','-fps_mode','passthrough','-c:a','aac','-b:a','160k','-movflags','+faststart',fallback])
    init=(out/'init.mp4').read_bytes();i=init.index(b'avcC');codec='avc1.'+init[i+5:i+8].hex();segments=[];at=0
    for line in (out/'index.m3u8').read_text().splitlines():
        if line.startswith('#EXTINF:'):length=float(line.split(':')[1].rstrip(','))
        elif line.endswith('.m4s'):segments.append({'src':line,'start':round(at,6),'duration':length,'bytes':(out/line).stat().st_size});at+=length
    hd=probe(out/'index.m3u8');hv=next(s for s in hd['streams'] if s['codec_type']=='video')
    manifest={'version':1,'label':f"{hv['height']}p / {fps:g} fps",'width':hv['width'],'height':hv['height'],'fps':fps,'duration':duration,'timestampOffset':-float(hv.get('start_time') or 0),'mime':f'video/mp4; codecs="{codec}'+(', mp4a.40.2' if a else '')+'"','init':'init.mp4','playlist':'index.m3u8','fallback':'compatible.mp4','stageAt':args.stage_at,'segments':segments,'encoding':{'source':source.name,'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceBytes':source.stat().st_size,'crf':19,'maxrate':'12M','audio':'original AAC copied' if a and a['codec_name']=='aac' else 'AAC 256k','trimmed':False}}
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'manifest':str(out/'manifest.json'),'stageAt':args.stage_at,'sourceUnchanged':True,'segments':len(segments),'bytes':sum((out/s['src']).stat().st_size for s in segments)},ensure_ascii=False))
if __name__=='__main__':main()
