import 'regenerator-runtime/runtime'
import * as THREE from 'three'
import ProjectedMaterial, { project, computeScaledDimensions } from './lib/ProjectedMaterial'
import { random } from 'lodash'
import WebGLApp from './lib/WebGLApp'
import assets from './lib/AssetManager'
import TWEEN from '@tweenjs/tween.js'
// import imgs from './assets/*.jpg'
import imgs from './assets/*.png'

// grab our canvas
const canvas = document.querySelector('#app')

// setup the WebGLRenderer
const webgl = new WebGLApp({
    canvas,
    // set the scene background color
    background: '#000000',
    // show the fps counter from stats.js
    showFps: false,
    orbitControls: { distance: 4 },
})

// attach it to the window to inspect in the console
window.webgl = webgl

// hide canvas
webgl.canvas.style.visibility = 'hidden'

// make an orthographic camera for projection
const ortho = 1.5
const orthographicCamera = new THREE.OrthographicCamera(-ortho, ortho, ortho, -ortho, 0.01, 100)
orthographicCamera.position.set(0, 0, 5) // value of z doesn't really matter

const camera = orthographicCamera


// preload the texture
Object.values(imgs).forEach((url) => {
    assets.queue({
        url,
        type: 'texture',
    })
})

const mainTextureKeys = Object.keys(imgs).filter((img) => img.indexOf("alt") === -1)

const allTextures = Object.entries(imgs).sort(([lkey, lurl], [rkey, rurl]) => {
    if (lkey < rkey) {
        return -1
    }
    if (lkey > rkey) {
        return 1
    }
    return 0
}).reduce((acc, [key, url]) => {
    if (key.indexOf("alt") === -1) {
        acc[key] = {
            main: url,
            alts: [],
        }
    } else {
        const mainKey = key.substr(0, key.indexOf("_alt"))
        acc[mainKey].alts.push(url)
    }
    return acc
}, {})

function makeShapes(mainTextureKeys, allTextures, index, count = 100) {
    const elements = new THREE.Group()
    const cover = false
    const mainTextureKey = mainTextureKeys[index]
    const texturesByIndex = allTextures[mainTextureKey]
    const imgUrl = texturesByIndex.main

    // optimisation to calculate dimensions once
    const [widthScaled, heightScaled] = computeScaledDimensions(
        assets.get(imgUrl),
        camera,
        0.8,
        cover
    )
    const dimensions = {widthScaled, heightScaled}

    for (let i = 0; i < count; i++) {
        // const geometry = new THREE.IcosahedronGeometry(random(0.1, 0.5))
        const geometry = new THREE.BoxGeometry(random(0.1, 0.5), random(0.1, 0.5), random(0.1, 0.5))
        const material = new ProjectedMaterial({
            camera: camera,
            texture: assets.get(imgUrl),
            color: '#000000',
            textureScale: 0.8,
            cover,
            dimensions
        })
        const element = new THREE.Mesh(geometry, material)

        element.position.x = random(-1.5, 1.5)
        element.position.y = random(-1.5, 1.5)
        element.position.z = random(-1.5, 1.5)
        element.scale.multiplyScalar(1.4)


        // element.rotation.x = random(0, Math.PI * 2)
        // element.rotation.y = random(0, Math.PI * 2)
        // element.rotation.z = random(0, Math.PI * 2)


        // and when you're ready, project the texture!
        project(element)

        elements.add(element)
    }
    return elements
}


function runGame(index = 0) {
    if (index >= mainTextureKeys.length) {
        console.log("TODO end scene")
        return
    }

    webgl.orbitControls.enabled = true
    // show canvas
    webgl.canvas.style.visibility = ''

    // create a bunch of meshes
    const elements = makeShapes(mainTextureKeys, allTextures, index)

    webgl.scene.add(elements)
    webgl.camera.lookAt(elements.position)

    const originalCamera = xyz(webgl.camera.position)
    const initial = xyz(elements.rotation)

    // move camera to random position outside the group
    const randomAngle = random(0, Math.PI * 2)
    const randomCameraX = 5 * Math.cos(randomAngle)
    const randomCameraY = 5 * Math.sin(randomAngle)
    webgl.camera.position.set(randomCameraX, randomCameraY, 0)
    webgl.camera.lookAt(elements.position)

    // texture to show when the objects have been aligned
    const mainImgUrl = allTextures[mainTextureKeys[index]].main
    const material = new THREE.SpriteMaterial( { map: assets.get(mainImgUrl), color: 0xffffff } )
    const sprite = new THREE.Sprite( material )
    sprite.position.z = 2
    sprite.scale.set(2,2,1)
    material.transparent = true
    let opacity = 0
    material.opacity = opacity

    let once = true
    let matched = false
    let cameraTween
    let spriteTween
    webgl.onUpdate(() => {
        if (compare(webgl.camera.rotation, initial, 0.15) && !matched && once) {
            // matched = true
            console.log("skipping matching...")
        }

        // this block runs once
        if (matched && once) {
            once = false
            webgl.orbitControls.enabled = false

            const from = xyz(webgl.camera.position)

            // fade in the solution image
            cameraTween = new TWEEN.Tween(from)
                .to(originalCamera,600)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(function () {
                    webgl.camera.position.set(from.x, from.y, from.z)
                    webgl.camera.lookAt(elements.position)
                })
                .onComplete(function () {
                    webgl.camera.lookAt(elements.position)

                    webgl.scene.add( sprite )
                    spriteTween = new TWEEN.Tween({opacity})
                        .to({opacity: 1},2000)
                        .easing(TWEEN.Easing.Quadratic.InOut)
                        .onUpdate(function (it) {
                            // sprite.scale.set(spriteInitialScale.x,spriteInitialScale.y,1)
                            material.opacity = it.opacity
                        })
                        .onComplete(function () {

                            elements.children.forEach((mesh: THREE.Mesh) => {
                                mesh.geometry.dispose()
                                mesh.material.dispose()
                            })
                            webgl.scene.remove(elements)
                            material.dispose()
                            webgl.scene.remove( sprite )
                            runGame(++index)
                        })
                        .start()
                })
                .start()

        }
        if (matched && !once) {
            TWEEN.update()
        }
    })
}

// load any queued assets
assets.load({ renderer: webgl.renderer }).then(() => {
    runGame(0)

    // add lights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
    directionalLight.position.set(0, 10, 10)
    webgl.scene.add(directionalLight)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    webgl.scene.add(ambientLight)

    // start animation loop
    webgl.start()
    webgl.draw()
})

// matcher to check if the objects have been aligned
function compare(left, right, precision) {
    const xComp = Math.abs(left.x - right.x) <= precision
    const yComp = Math.abs(left.y - right.y) <= precision
    const zComp = Math.abs(left.z - right.z) <= precision
    return xComp && yComp && zComp
}

function xyz(thing) {
    return {
        x: thing.x,
        y: thing.y,
        z: thing.z,
    }
}
