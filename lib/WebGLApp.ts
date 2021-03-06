// Taken from https://github.com/marcofugaro/threejs-modern-app/blob/master/src/lib/WebGLApp.js
import * as THREE from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls'
import createTouches from 'touches'
import dataURIToBlob from 'datauritoblob'
import Stats from 'stats.js'
import State from 'controls-state'
import wrapGUI from 'controls-gui'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
// import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass'
import {GlitchPass} from "./GlitchPass"
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass'
import { LuminosityShader } from 'three/examples/jsm/shaders/LuminosityShader'
import { HalftonePass } from 'three/examples/jsm/postprocessing/HalftonePass'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass'

const frustumSize = 5

export default class WebGLApp {
    #updateListeners = []
    #tmpTarget = new THREE.Vector3()
    #rafID
    #lastTime

    renderer
    canvas
    maxPixelRatio
    maxDeltaTime
    camera
    scene
    gl
    time
    isRunning
    gpu
    touchHandler
    width
    height
    pixelRatio
    stats
    orbitControls
    composer
    controls
    world
    tween

    constructor({
                    background = '#000',
                    backgroundAlpha = 1,
                    fov = 45,
                    near = 0.01,
                    far = 100,
                    ...options
                } = {}) {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            // enabled for saving screenshots of the canvas,
            // may wish to disable this for perf reasons
            preserveDrawingBuffer: true,
            ...options,
        })

        this.renderer.sortObjects = false
        this.canvas = this.renderer.domElement

        this.renderer.setClearColor(background, backgroundAlpha)

        // clamp pixel ratio for performance
        this.maxPixelRatio = options.maxPixelRatio || 2
        // clamp delta to stepping anything too far forward
        this.maxDeltaTime = options.maxDeltaTime || 1 / 30

        // setup a basic camera
        // this.camera = new THREE.PerspectiveCamera(fov, 1, near, far)


        const aspect = window.innerWidth / window.innerHeight
        this.camera = new THREE.OrthographicCamera(frustumSize * aspect / - 2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / - 2, near, far)
        this.camera.position.set(0, 0, 5)
        // this.camera.zoom = 2

        this.scene = new THREE.Scene()

        this.gl = this.renderer.getContext()

        this.time = 0
        this.isRunning = false
        this.#lastTime = performance.now()
        this.#rafID = null

        // detect the gpu info
        // const gpu = getGPUTier({ glContext: this.renderer.getContext() })
        // console.log(gpu)
        // this.gpu = {
        //     name: gpu.type,
        //     tier: Number(gpu.tier.slice(-1)),
        //     isMobile: gpu.tier.toLowerCase().includes('mobile'),
        // }

        // handle resize events
        window.addEventListener('resize', this.resize)
        window.addEventListener('orientationchange', this.resize)

        // force an initial resize event
        this.resize()

        // __________________________ADDONS__________________________

        // really basic touch handler that propagates through the scene
        this.touchHandler = createTouches(this.canvas, {
            target: this.canvas,
            filtered: true,
        })
        this.touchHandler.on('start', (ev, pos) => this.traverse('onPointerDown', ev, pos))
        this.touchHandler.on('move', (ev, pos) => this.traverse('onPointerMove', ev, pos))
        this.touchHandler.on('end', (ev, pos) => this.traverse('onPointerUp', ev, pos))

        // expose a composer for postprocessing passes
        if (options.postprocessing) {
            this.composer = new EffectComposer(this.renderer)
            this.composer.addPass(new RenderPass(this.scene, this.camera))

            // half-tone pass not looking great with grayscale images
            // this.composer.addPass(new HalftonePass( window.innerWidth, window.innerHeight, {
            //     shape: 1,
            //     radius: 4,
            //     rotateR: Math.PI / 12,
            //     rotateB: Math.PI / 12 * 2,
            //     rotateG: Math.PI / 12 * 3,
            //     scatter: 0,
            //     blending: 1,
            //     blendingMode: 1,
            //     greyscale: false,
            //     disable: false
            // }))

            const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
            const params = {
                exposure: 1,
                bloomStrength: 0.4,
                bloomThreshold: 0,
                bloomRadius: 0
            };
            bloomPass.threshold = params.bloomThreshold;
            bloomPass.strength = params.bloomStrength;
            bloomPass.radius = params.bloomRadius;
            this.composer.addPass(bloomPass)

            this.composer.addPass(new ShaderPass(LuminosityShader))
            this.composer.addPass(new GlitchPass())
        }

        // set up a simple orbit controller
        if (options.orbitControls) {
            this.orbitControls = new OrbitControls(this.camera, this.canvas)
            this.orbitControls.enableDamping = true
            this.orbitControls.minDistance = this.orbitControls.maxDistance = 5
            this.orbitControls.maxAzimuthAngle = 0
            this.orbitControls.minAzimuthAngle = 0
        }

        // Attach the Cannon physics engine
        if (options.world) this.world = options.world

        // Attach Tween.js
        if (options.tween) this.tween = options.tween

        // show the fps meter
        if (options.showFps) {
            this.stats = new Stats()
            this.stats.showPanel(0)
            document.body.appendChild(this.stats.dom)
        }

        // initialize the controls-state
        if (options.controls) {
            const controlsState = State(options.controls)
            this.controls = options.hideControls ? controlsState : wrapGUI(controlsState)
        }
    }

    resize = ({
                  width = window.innerWidth,
                  height = window.innerHeight,
                  pixelRatio = Math.min(this.maxPixelRatio, window.devicePixelRatio),
              } = {}) => {
        this.width = width
        this.height = height
        this.pixelRatio = pixelRatio

        // update pixel ratio if necessary
        if (this.renderer.getPixelRatio() !== pixelRatio) {
            this.renderer.setPixelRatio(pixelRatio)
        }

        // setup new size & update camera aspect if necessary
        this.renderer.setSize(width, height)
        if (this.camera.isPerspectiveCamera) {
            this.camera.aspect = width / height
        } else {
            var aspect = width / height
            this.camera.left = frustumSize * aspect / - 2;
            this.camera.right = frustumSize * aspect / 2;
            this.camera.top = frustumSize / 2;
            this.camera.bottom = - frustumSize / 2;
        }
        this.camera.updateProjectionMatrix()

        // resize also the composer
        if (this.composer) {
            this.composer.setSize(pixelRatio * width, pixelRatio * height)
        }

        // recursively tell all child objects to resize
        this.scene.traverse(obj => {
            if (typeof obj.resize === 'function') {
                obj.resize({
                    width,
                    height,
                    pixelRatio,
                })
            }
        })

        // draw a frame to ensure the new size has been registered visually
        this.draw()
        return this
    }

    // convenience function to trigger a PNG download of the canvas
    saveScreenshot = ({ width = 2560, height = 1440, fileName = 'image.png' } = {}) => {
        // force a specific output size
        this.resize({ width, height, pixelRatio: 1 })
        this.draw()

        const dataURI = this.canvas.toDataURL('image/png')

        // reset to default size
        this.resize()
        this.draw()

        // save
        saveDataURI(fileName, dataURI)
    }

    update = (dt, time) => {
        if (this.orbitControls) {
            this.orbitControls.update()
        }

        // recursively tell all child objects to update
        this.scene.traverse(obj => {
            if (typeof obj.update === 'function') {
                obj.update(dt, time)
            }
        })

        if (this.world) {
            // update the Cannon physics engine
            this.world.step(dt)

            // recursively tell all child bodies to update
            this.world.bodies.forEach(body => {
                if (typeof body.update === 'function') {
                    body.update(dt, time)
                }
            })
        }

        if (this.tween) {
            // update the Tween.js engine
            this.tween.update()
        }

        // call the update listeners
        this.#updateListeners.forEach(fn => fn(dt, time))

        return this
    }

    setUpdate(fn) {
        this.#updateListeners = [fn]
    }

    onUpdate(fn) {
        this.#updateListeners.push(fn)
    }

    draw = () => {
        if (this.composer) {
            // make sure to always render the last pass
            this.composer.passes.forEach((pass, i, passes) => {
                const isLastElement = i === passes.length - 1

                if (isLastElement) {
                    pass.renderToScreen = true
                } else {
                    pass.renderToScreen = false
                }
            })

            this.composer.render()
        } else {
            this.renderer.render(this.scene, this.camera)
        }
        return this
    }

    start = () => {
        if (this.#rafID !== null) return
        this.#rafID = window.requestAnimationFrame(this.animate)
        this.isRunning = true
        return this
    }

    stop = () => {
        if (this.#rafID === null) return
        window.cancelAnimationFrame(this.#rafID)
        this.#rafID = null
        this.isRunning = false
        return this
    }

    animate = () => {
        if (!this.isRunning) return
        window.requestAnimationFrame(this.animate)

        if (this.stats) this.stats.begin()

        const now = performance.now()
        const dt = Math.min(this.maxDeltaTime, (now - this.#lastTime) / 1000)
        this.time += dt
        this.#lastTime = now
        this.update(dt, this.time)
        this.draw()

        if (this.stats) this.stats.end()
    }

    traverse = (fn, ...args) => {
        this.scene.traverse(child => {
            if (typeof child[fn] === 'function') {
                child[fn].apply(child, args)
            }
        })
    }
}

function saveDataURI(name, dataURI) {
    const blob = dataURIToBlob(dataURI)

    // force download
    const link = document.createElement('a')
    link.download = name
    link.href = window.URL.createObjectURL(blob)
    link.onclick = setTimeout(() => {
        window.URL.revokeObjectURL(blob)
        link.removeAttribute('href')
    }, 0)

    link.click()
}
