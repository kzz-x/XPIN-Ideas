"""Prepare compact, same-edit movie files. Requires ffmpeg / ffprobe on PATH."""
import argparse, hashlib, json, os, pathlib, subprocess, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
def probe(p):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)],text=True,encoding='utf-8'))
def run(args):
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','warning','-y',*[v.as_posix() if isinstance(v,pathlib.Path) else str(v) for v in args]],check=True)
def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('source',type=pathlib.Path);ap.add_argument('--stage-at',required=True,type=float);ap.add_argument('--bitrate-k',type=int,default=2300);ap.add_argument('--preset',default='veryslow');ap.add_argument('--output',type=pathlib.Path,default=ROOT/'assets/media');args=ap.parse_args()
    source=args.source.resolve();out=args.output.resolve();hd=out/'film-hd.mp4';mobile=out/'film-mobile.mp4';manifest=out/'film-hd/manifest.json'
    if not source.is_file():raise SystemExit('Source not found')
    if source in [hd,mobile]:raise SystemExit('Keep the original outside generated output files')
    if args.bitrate_k<300:raise SystemExit('Bitrate must be at least 300 kbps')
    info=probe(source);v=next(s for s in info['streams'] if s['codec_type']=='video');duration=float(v.get('duration') or info['format']['duration']);n,d=map(int,v['avg_frame_rate'].split('/'));fps=n/d
    if not 0<=args.stage_at<duration:raise SystemExit('The stage point must fall within the source video')
    out.mkdir(parents=True,exist_ok=True);manifest.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.film-r26-',dir=out) as tmp:
        tmp=pathlib.Path(tmp);log=tmp/'x264';h=tmp/'film-hd.mp4';m=tmp/'film-mobile.mp4'
        common=['-i',source,'-map','0:v:0','-vf','scale=w=min(1920\\,iw):h=min(1080\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2','-c:v','libx264','-preset',args.preset,'-b:v',f'{args.bitrate_k}k','-maxrate',f'{round(args.bitrate_k*3600/2300)}k','-bufsize',f'{round(args.bitrate_k*7200/2300)}k','-pix_fmt','yuv420p','-profile:v','high','-g',round(fps*2),'-keyint_min',round(fps*2),'-sc_threshold','0','-fps_mode','passthrough','-passlogfile',log]
        run([*common,'-pass','1','-an','-f','null',os.devnull]);run([*common,'-map','0:a:0?','-pass','2','-c:a','aac','-b:a','160k','-movflags','+faststart',h])
        run(['-i',source,'-map','0:v:0','-map','0:a:0?','-vf','scale=w=min(1280\\,iw):h=min(720\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30','-c:v','libx264','-preset','slow','-crf','24','-maxrate','900k','-bufsize','1800k','-pix_fmt','yuv420p','-g','60','-c:a','aac','-b:a','128k','-movflags','+faststart',m])
        hv=next(s for s in probe(h)['streams'] if s['codec_type']=='video');h.replace(hd);m.replace(mobile)
    data={'version':2,'label':f"{hv['height']}p / {fps:g} fps",'width':hv['width'],'height':hv['height'],'fps':fps,'duration':float(hv.get('duration') or duration),'timestampOffset':0,'mime':'video/mp4; codecs="avc1.64002a, mp4a.40.2"','stageAt':args.stage_at,'segments':[],'file':'../film-hd.mp4','fileBytes':hd.stat().st_size,'fallback':'../film-mobile.mp4','mobileFallback':'../film-mobile.mp4','mobileBytes':mobile.stat().st_size,'mobileFps':30,'encoding':{'source':source.name,'sourceSHA256':hashlib.file_digest(source.open('rb'),'sha256').hexdigest() if hasattr(hashlib,'file_digest') else hashlib.sha256(source.read_bytes()).hexdigest(),'video':f'H.264 / two-pass {args.bitrate_k} kbps VBR / {args.preset}','audio':'AAC 160 kbps','framesRemoved':False,'trimmed':False}}
    manifest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'manifest':str(manifest),'hdBytes':hd.stat().st_size,'mobileBytes':mobile.stat().st_size,'sourceUnchanged':True}))
if __name__=='__main__':main()
