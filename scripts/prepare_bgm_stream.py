"""Encode external lossless BGM masters as compact, whole-track AAC assets."""
import argparse,json,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1];BASE=ROOT/'assets/media/bgm'
def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('masters',type=pathlib.Path,help='Folder containing tank-b-intro.flac, tank-b-loop.flac and tank-b-outro.flac');args=ap.parse_args()
    meta=json.loads((BASE/'tank-b-loop.json').read_text(encoding='utf-8'));out=BASE/'stream';out.mkdir(exist_ok=True)
    manifest={'version':2,'sampleRate':48000,'channels':2,'lossless':False,'codec':'AAC 160 kbps','delivery':'whole tracks; exact original sample ranges after decode','gates':meta['estimated_phrase_exit_gates'],'tracks':{}}
    for name in ['intro','loop','outro']:
        source=args.masters/f'tank-b-{name}.flac';dest=out/f'{name}.m4a'
        raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-ar','48000','-ac','2','-f','s24le','-acodec','pcm_s24le','-']);frames=len(raw)//6
        if frames!=meta[name]['frames']:raise SystemExit(f'{name}: master sample count differs from authored music boundaries')
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-c:a','aac','-b:a','160k','-ar','48000','-ac','2','-movflags','+faststart',str(dest)],check=True)
        manifest['tracks'][name]={'frames':frames,'duration':frames/48000,'chunks':[{'src':dest.name,'startFrame':0,'frames':frames,'bytes':dest.stat().st_size}]}
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'tracks':3,'bytes':sum(t['chunks'][0]['bytes'] for t in manifest['tracks'].values())}))
if __name__=='__main__':main()
