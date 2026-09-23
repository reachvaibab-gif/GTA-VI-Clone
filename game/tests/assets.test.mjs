import test from 'node:test';import assert from 'node:assert/strict';import {selectTexture} from '../scripts/asset-utils.mjs';
const jpg={url:'https://dl.polyhaven.com/file/ph-assets/test.jpg'};
test('PBR loader resolves API display keys, not just filename suffixes',()=>{const spec={Diffuse:{'1k':{jpg}},Rough:{'1k':{jpg}},nor_gl:{'1k':{png:jpg}}};assert.equal(selectTexture(spec,'color').key,'Diffuse');assert.equal(selectTexture(spec,'roughness').key,'Rough');assert.equal(selectTexture(spec,'normal').format,'png');});
test('missing optional map is explicit, unknown asset origins are rejected',()=>{assert.equal(selectTexture({},'color'),null);assert.throws(()=>selectTexture({Diffuse:{'1k':{jpg:{url:'https://example.net/tracking'}}}},'color'));});
