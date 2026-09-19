import assert from 'node:assert/strict';

/** CI uses software Vulkan; these flags never affect the shipped game. */
export function browserOptions(platform = process.platform, env = process.env) {
  return {
    headless: env.WORKSHOP_HEADED === '1' ? false : (platform === 'darwin' && !env.CI ? false : true),
    dumpio: env.WORKSHOP_GPU_LOG === '1',
    args: ['--enable-unsafe-webgpu', ...(platform === 'linux' ? [
      '--enable-features=Vulkan', '--use-angle=vulkan',
      '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader',
      '--disable-vulkan-surface', '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist', '--disable-dev-shm-usage',
    ] : [])],
  };
}

/** A real GPU clear/readback, independent of Starhold and its renderers. */
export async function verifyWebGPU(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    // Isolate the probe from game boot while keeping a trustworthy loopback origin.
    await page.route('**/__workshop_gpu_probe__', route => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>WebGPU environment probe</title>',
    }));
    await page.goto('http://127.0.0.1:5199/__workshop_gpu_probe__');
    const result = await page.evaluate(async () => {
      if (!navigator.gpu) throw new Error('WebGPU is unavailable in the test browser.');
      let adapter;
      for (let attempt = 0; attempt < 10 && !adapter; attempt++) {
        adapter = await navigator.gpu.requestAdapter();
        if (!adapter) await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!adapter) throw new Error('No WebGPU adapter. Check the Vulkan loader and software driver.');
      const device = await adapter.requestDevice();
      const errors = [];
      device.addEventListener('uncapturederror', event => errors.push(event.error.message));
      const texture = device.createTexture({size: [1, 1], format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC});
      const buffer = device.createBuffer({size: 256, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ});
      try {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({colorAttachments: [{view: texture.createView(),
          clearValue: {r: 1, g: 0, b: 0, a: 1}, loadOp: 'clear', storeOp: 'store'}]});
        pass.end();
        encoder.copyTextureToBuffer({texture}, {buffer, bytesPerRow: 256}, [1, 1]);
        device.queue.submit([encoder.finish()]);
        await buffer.mapAsync(GPUMapMode.READ);
        const pixel = Array.from(new Uint8Array(buffer.getMappedRange()).slice(0, 4));
        buffer.unmap();
        const info = adapter.info;
        return {pixel, errors, adapter: info ? {vendor: info.vendor, architecture: info.architecture,
          device: info.device, description: info.description} : null, userAgent: navigator.userAgent};
      } finally {buffer.destroy(); texture.destroy(); device.destroy();}
    });
    assert.deepEqual(result.errors, [], 'GPU environment emitted validation errors');
    assert.deepEqual(result.pixel, [255, 0, 0, 255], 'GPU environment did not render/read real pixels');
    return result;
  } finally {await context.close();}
}
