import * as Tone from 'tone'
import createSampler from '../util/create-sampler'
import transpose from '../theory/transpose.js'
import * as _ from 'lodash'

const combine = (pitches = [], octaves = []) =>
    octaves.reduce((notes, octave) => notes.concat(pitches.map(pc => `${pc}${octave}`)), [])


const pianoNotes = combine(['C', 'E', 'G', 'B'], [3, 4, 5])
const violinNotes = combine(['C', 'E', 'G', 'B'], [2, 3, 4])

function* makeNoteGenerator(notes) {
    for (
        let i = 0;
        i < notes.length;
        i === notes.length - 1 ? (i = 0) : (i += 1)
    ) {
        yield notes[i]
    }
}

const trillNoteSets = [['D5', 'C5'], ['D#5', 'D5'], ['F5', 'D#5']]

const trillGenerators = trillNoteSets.map(notes => makeNoteGenerator(notes))

const bassFreq = 32;

// var chordNotes = {
//     // "Dm" : ["D4", "F4", "C4", "A4"],
//     // "A7" : ["G4", "C#4", "A4", "E4"],
//     // "C7" : ["C4", "A#4", "E4", "F#4"],
//     // "Fmaj" : [ "F4", "C4","D4", "A4"],
//     // "D7" : ["C5", "F#4", "E5", "A#4"],
//     // "Gmaj" : ["A4","D5", "F#4",  "B4"],
//     // "Cmaj" : ["G4", "C5", "E5", "B4"],
//
//     // "-Dm" : ["D3", "F3", "C3", "A3"],
//     // "-A7" : ["G3", "C#3", "A3", "E3"],
//     // "-C7" : ["C3", "A#3", "E3", "F#3"],
//     // "-Fmaj" : [ "F3", "C3","D3", "A3"],
//     // "-D7" : ["C4", "F#3", "E4", "A#3"],
//     // "-Gmaj" : ["A3","D4", "F#3",  "B3"],
//     // "-Cmaj" : ["G3", "C4", "E4", "B3"],
// };


function getNotes(l = 4) {
    return Object.entries({
        "C major": [ "C", "E" ,"G"],
        "C# major" : ["C#", "E#", "G#"],
        "D major": ["D", "F#", "A"],
        "Eb major": ["Eb", "G", "Bb"],
        "E major": ["E", "G#", "B"],
        "F major": ["F", "A", "C"],
        "F# major": ["F#", "A#", "C#"],
        "G major": ["G", "B", "D"],
        "Ab major": ["Ab", "C", "Eb"],
        "A major": ["A", "C#", "E"],
        "Bb major": ["Bb", "D", "F"],
        "B major": ["B", "D#", "F#"],
    }).reduce((acc, [key, notes]) => {
        acc[key] = notes.map((note) => `${note}${l}`)
        return acc
    }, {})
}

function osc() {
    const oscillators = [];

    for (let i = 0; i < 8; i++) {
        oscillators.push(new Tone.Oscillator({
            frequency: bassFreq * i,
            type: "sawtooth4",
            volume: -Infinity,
            detune: Math.random() * 30 - 15,
        }).toDestination());
    }

    oscillators.forEach(o => {
        o.start();
        o.volume.rampTo(-20, 1);
    });

    return oscillators
}

let isPlaying = false

let level = 0

function getLevel() {
    return level
}

const bpm = 80
let noteCounter = 0
export function playMusic(level_ = 0) {
    level = level_

    // const oscillators = osc()
    // // from 0.5 to 2.0
    // const oscVal = 0.5
    // oscillators.forEach((osc, i) => {
    //     osc.frequency.rampTo(bassFreq * i * oscVal, 0.4);
    // });

    const plucky = new Tone.MonoSynth({
        oscillator: {
            type: "square"
        },
        envelope: {
            attack: 0.1
        }
    }).toDestination();
    plucky.volume.value = -8;

    const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
            partials: [0, 2, 3, 4],
        },
    }).toDestination()
    synth.volume.value = -8;

    const conga = new Tone.MembraneSynth({
        pitchDecay: 0.008,
        octaves: 2,
        envelope: {
            attack: 0.0006,
            decay: 0.5,
            sustain: 0
        }
    }).toDestination();
    conga.volume.value = -7;

    // filtering the hi-hats a bit
    // to make them sound nicer
    const lowPass = new Tone.Filter({
        frequency: 14000,
    }).toDestination();

    // we can make our own hi hats with
    // the noise synth and a sharp filter envelope
    const openHiHat = new Tone.NoiseSynth({
        volume: -20,
        envelope: {
            attack: 0.01,
            decay: 0.1
        },
    }).connect(lowPass).toDestination();


    if (!isPlaying) {
        isPlaying = true
        Tone.Transport.bpm.value = bpm
        Tone.Transport.scheduleRepeat((t) => {
            const level = getLevel()

            let allChordNotes = getNotes(3)
            let allMelodyNotes = getNotes(4)
            let allMelodyNotes2 = getNotes(5)
            let allMelodyNotes3 = getNotes(6)


            noteCounter += 5
            if (noteCounter >= Object.values(allChordNotes).length) {
                noteCounter = noteCounter - Object.values(allChordNotes).length
            }

            const chordNotes = Object.values(allChordNotes)[noteCounter]
            const melodyNotes = Object.values(allMelodyNotes)[noteCounter]
            const melodyNotes2 = Object.values(allMelodyNotes2)[noteCounter]
            const melodyNotes3 = Object.values(allMelodyNotes3)[noteCounter]
            // const notes = _.sample(Object.values(chordNotes))

            if (level == 0) {
                chordNotes.forEach((note, idx) => {
                    synth.triggerAttackRelease(note, "8n", t)
                })
            } else {
                chordNotes.forEach((note, idx) => {
                    if (idx > 1) {
                        synth.triggerAttackRelease(note, "8n", t + 0.25)
                    } else {
                        synth.triggerAttackRelease(note, "8n", t)
                    }
                })
            }

            if (level >= 1) {
                plucky.triggerAttackRelease(_.sample(melodyNotes), "32n", t + 0.5)
            }
            if (level >= 2) {
                plucky.triggerAttackRelease(_.sample(melodyNotes), "64n", t + 0.75)
                plucky.triggerAttackRelease(_.sample(melodyNotes2), "64n", t + 0.875)
            }
            if (level >= 3) {
                plucky.triggerAttackRelease(_.sample(melodyNotes), "64n", t + 1)
                plucky.triggerAttackRelease(_.sample(melodyNotes2), "64n", t + 1.125)

                conga.triggerAttackRelease(_.sample(["G3", "C4", "C4", "C4"]), "4n", t + 0.25)
                if (Math.random() < (level / 10)) {
                    conga.triggerAttackRelease(_.sample(["G3", "C4", "C4", "C4"]), "4n", t + 0.5)
                    if (Math.random() < 0.8) {
                        conga.triggerAttackRelease(_.sample(["G3", "C4", "C4", "C4"]), "4n", t + 0.75)
                        if (Math.random() < 0.9) {
                            conga.triggerAttackRelease(_.sample(["G3", "C4", "C4", "C4"]), "8n", t + 0.875)
                        }
                    }
                }
            }
            if (level >= 4) {
                plucky.triggerAttackRelease(_.sample(melodyNotes3), "64n", t + 1.25)
                plucky.triggerAttackRelease(_.sample(melodyNotes3), "64n", t + 1.375)

                if (Math.random() < (level / 10)) {
                    openHiHat.triggerAttackRelease("16n", t + 0.25)
                    if (Math.random() < 0.5) {
                        openHiHat.triggerAttackRelease("16n", t + 0.375)
                        if (Math.random() < 0.5) {
                            openHiHat.triggerAttackRelease("16n", t + 0.5)
                        } else {
                            openHiHat.triggerAttackRelease("16n", t + 0.625)
                        }
                    } else {
                        openHiHat.triggerAttackRelease("16n", t + 0.5)
                        if (Math.random() < 0.5) {
                            openHiHat.triggerAttackRelease("16n", t + 0.625)
                        } else {
                            openHiHat.triggerAttackRelease("16n", t + 0.75)
                        }
                    }
                }
            }

        }, "2n", "0")
        Tone.Transport.start()
    }

    // Tone.Transport.bpm.rampTo(bpm - (level * 3), 10)

    return () => {
        Tone.Transport.stop()
    }
}
