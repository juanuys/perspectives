import * as THREE from 'three'

export default async function loadTexture(url, options) {

  const loader = new THREE.TextureLoader()
  function promiseLoader(url) {
    return new Promise((resolve, reject) => {
      loader.load(url, data=> resolve(data), null, reject)
    })
  }
  const texture = await promiseLoader(url)
  // console.log(texture)
  // setTextureParams(url, texture, options)

  if (options.renderer) {
    // Force texture to be uploaded to GPU immediately,
    // this will avoid "jank" on first rendered frame
    options.renderer.initTexture(texture)
  }
  return texture
}

function setTextureParams(url, texture, opt) {
  if (typeof opt.flipY === 'boolean') texture.flipY = opt.flipY
  if (typeof opt.mapping !== 'undefined') {
    texture.mapping = opt.mapping
  }
  if (typeof opt.format !== 'undefined') {
    texture.format = opt.format
  } else {
    // choose a nice default format
    const isJPEG = url.search(/\.(jpg|jpeg)$/) > 0 || url.search(/^data:image\/jpeg/) === 0
    texture.format = isJPEG ? THREE.RGBFormat : THREE.RGBAFormat
  }
  if (opt.repeat) texture.repeat.copy(opt.repeat)
  texture.wrapS = opt.wrapS || THREE.ClampToEdgeWrapping
  texture.wrapT = opt.wrapT || THREE.ClampToEdgeWrapping
  texture.minFilter = opt.minFilter || THREE.LinearMipMapLinearFilter
  texture.magFilter = opt.magFilter || THREE.LinearFilter
  texture.generateMipmaps = opt.generateMipmaps !== false
}
