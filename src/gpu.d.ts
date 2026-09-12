// Browser WebGPU is not yet included in TypeScript's lib.dom. Keep this small
// boundary declaration local; renderer data and public contracts remain typed.
interface Navigator { readonly gpu?: any }
declare const GPUBufferUsage: { VERTEX:number; COPY_DST:number; UNIFORM:number };
declare const GPUTextureUsage: { RENDER_ATTACHMENT:number; TEXTURE_BINDING:number };
