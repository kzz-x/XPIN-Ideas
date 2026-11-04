import {createIslandDocumentLoader as online} from './island-document-loader-r08b.mjs';
import {createIslandDocumentLoader as inline} from './island-document-loader-inline-r01.mjs';
export function createIslandDocumentLoader(frame,source,options){return globalThis.DOT_SINGLE_RESOURCES?inline(frame,source,options):online(frame,source,options);}
