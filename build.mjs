import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),dist=path.resolve(root,'dist');
if(!dist.startsWith(root+path.sep)||path.basename(dist)!=='dist')throw Error('Unsafe build target');
await fs.rm(dist,{recursive:true,force:true});await fs.mkdir(dist,{recursive:true});
const excludedPreview=path.resolve(root,'assets','dot','preview');
for(const item of ['index.html','styles.css','design-r02.css','design-r03.css','design-r04.css','design-r07.css','design-r08.css','src','assets'])await fs.cp(path.join(root,item),path.join(dist,item),{recursive:true,filter:source=>path.basename(source)!=='film-placeholder.mp4'&&path.resolve(source)!==excludedPreview});
console.log(JSON.stringify({directory:dist,originalMediaExcluded:true,historicalPreviewExcluded:true}));
