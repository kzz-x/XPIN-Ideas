"""Split the supplied lossless music at exact sample boundaries for early playback."""
import hashlib,json,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=ROOT/'assets/media/bgm'
def main():
    meta=json.loads((BASE/'tank-b-loop.json').read_text(encoding='utf-8'))
    out=BASE/'stream';out.mkdir(exist_ok=True)
    manifest={'version':1,'sampleRate':48000,'channels':2,'lossless':True,'chunkFrames':96000,'gates':meta['estimated_phrase_exit_gates'],'tracks':{}}
    for name in ['intro','loop','outro']:
        raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(BASE/f'tank-b-{name}.flac'),'-f','s24le','-acodec','pcm_s24le','-'])
        frames=len(raw)//6
        assert frames==meta[name]['frames'],(name,frames)
        chunks=[]
        for i,start in enumerate(range(0,frames,96000)):
            end=min(frames,start+96000);piece=raw[start*6:end*6];file=out/f'{name}-{i:02d}.flac'
            subprocess.run(['ffmpeg','-v','error','-y','-f','s24le','-ar','48000','-ac','2','-i','pipe:0','-c:a','flac','-compression_level','8',str(file)],input=piece,check=True)
            decoded=subprocess.check_output(['ffmpeg','-v','error','-i',str(file),'-f','s24le','-acodec','pcm_s24le','-'])
            assert decoded==piece,file
            chunks.append({'src':file.name,'startFrame':start,'frames':end-start,'bytes':file.stat().st_size})
        manifest['tracks'][name]={'frames':frames,'duration':frames/48000,'pcmSHA256':hashlib.sha256(raw).hexdigest(),'chunks':chunks}
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'chunks':sum(len(t['chunks']) for t in manifest['tracks'].values()),'pcmEqualToOriginal':True,'bytes':sum(c['bytes'] for t in manifest['tracks'].values() for c in t['chunks'])}))
if __name__=='__main__':main()
