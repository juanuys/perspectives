import * as THREE from "three";
import assets from "../AssetManager";
import ProjectedMaterial, { project, computeScaledDimensions } from '../ProjectedMaterial'
import { random } from 'lodash'


export function makeShapes(camera, mainTextureKeys, allTextures, index, count = 100) {
    const baseElements = []
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

        project(element)

        elements.add(element)
        baseElements.push(element)
    }

    baseElements.forEach((el: THREE.Mesh) => {
        const geometry = el.geometry.clone()
        const material = new ProjectedMaterial({
            camera: camera,
            texture: assets.get(texturesByIndex.alts[0]),
            color: '#000000',
            textureScale: 0.8,
            cover,
            dimensions
        })
        const element = new THREE.Mesh(geometry, material)

        element.position.x = el.position.x - 0.01
        element.position.y = el.position.y - 0.01
        element.position.z = el.position.z - 0.01
        element.scale.multiplyScalar(1.4)


        var orig = element.rotation.y
        element.rotation.y = Math.PI
        project(element)
        element.rotation.y = orig

        elements.add(element)
    })

    return elements
}
