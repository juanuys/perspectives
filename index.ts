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

// preload the texture
const textureKeys = Object.entries(imgs).map(([key, url]) => {
    const textureKey = assets.queue({
        url,
        type: 'texture',
    })
    return textureKey
})

function makeCones(NUM_ELEMENTS: number, elements: THREE.Group, textureKey) {
    for (let i = 0; i < NUM_ELEMENTS; i++) {
        // const geometry = new THREE.IcosahedronGeometry(random(0.1, 0.5))
        const geometry = new THREE.ConeGeometry(random(0.1, 0.5), random(1, 2), 8)
        const material = new ProjectedMaterial({
            // use the scene camera itself
            camera: webgl.camera,
            texture: assets.get(textureKey),
            color: '#000000',
            textureScale: 0.8,
        })
        const element = new THREE.Mesh(geometry, material)

        // move the meshes any way you want!
        if (i < NUM_ELEMENTS * 0.3) {
            element.position.x = random(-0.5, 0.5)
            element.position.y = random(-1.1, 0.5)
            element.position.z = random(-0.3, 0.3)
            element.scale.multiplyScalar(1.4)
        } else {
            element.position.x = random(-1, 1, true)
            element.position.y = random(-2, 2, true)
            element.position.z = random(-0.5, 0.5)
        }
        element.rotation.x = random(0, Math.PI * 2)
        element.rotation.y = random(0, Math.PI * 2)
        element.rotation.z = random(0, Math.PI * 2)

        // and when you're ready, project the texture!
        project(element)

        elements.add(element)
    }
}

function makeCubes(NUM_ELEMENTS: number, elements: THREE.Group, textureKey, rotate: boolean = true) {
    const cover = false

    // optimisation to calculate dimensions once
    const [widthScaled, heightScaled] = computeScaledDimensions(
        assets.get(textureKey),
        webgl.camera,
        0.8,
        cover
    )
    const dimensions = {widthScaled, heightScaled}

    for (let i = 0; i < NUM_ELEMENTS; i++) {
        // const geometry = new THREE.IcosahedronGeometry(random(0.1, 0.5))
        const geometry = new THREE.BoxGeometry(random(0.1, 0.5), random(0.1, 0.5), random(0.1, 0.5))
        const material = new ProjectedMaterial({
            // use the scene camera itself
            camera: webgl.camera,
            texture: assets.get(textureKey),
            color: '#000000',
            textureScale: 0.8,
            cover,
            dimensions
        })
        const element = new THREE.Mesh(geometry, material)

        // move the meshes any way you want!
        if (i < NUM_ELEMENTS * 0.3) {
            element.position.x = random(-0.5, 0.5)
            element.position.y = random(-1.1, 0.5)
            // element.position.z = random(-0.3, 0.3)
            element.position.z = random(-2.3, 2.3)
            element.scale.multiplyScalar(1.4)
        } else {
            element.position.x = random(-1, 1, true)
            element.position.y = random(-2, 2, true)
            element.position.z = random(-0.5, 0.5)
        }

        if (rotate) {
            element.rotation.x = random(0, Math.PI * 2)
            element.rotation.y = random(0, Math.PI * 2)
            element.rotation.z = random(0, Math.PI * 2)
        }

        // and when you're ready, project the texture!
        project(element)

        elements.add(element)
    }
}


function runGame(index = 0) {
    if (index >= textureKeys.length) {
        console.log("TODO end scene")
        return
    }
    const textureKey = textureKeys[index]

    webgl.orbitControls.enabled = true
    // show canvas
    webgl.canvas.style.visibility = ''

    // create a bunch of meshes
    const elements = new THREE.Group()
    const NUM_ELEMENTS = 100

    makeCubes(NUM_ELEMENTS, elements, textureKey, false)

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
    const material = new THREE.SpriteMaterial( { map: assets.get(textureKey), color: 0xffffff } )
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
        if (compare(webgl.camera.rotation, initial, 0.18) && !matched && once) {
            matched = true
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
