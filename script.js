let noteKeyDown = [false, false, false, false];

const middleC = 440 / Math.pow(2, 0.75);
const majorScaleSteps = [0, 2, 4, 5, 7, 9, 11];
const minRampTime = 0.005;
let currentOctave = 0;

let leftHanded = false;

let baseAmplitude = 0;
let baseFrequency = middleC;

let audioContext;
let oscillator;
let oscillatorAmplitudeNode;
let lowPassFilter;
let mixerNode;


function setAudioParameter(parameter, value, rampDuration = minRampTime) {
    parameter.cancelAndHoldAtTime(audioContext.currentTime)
    parameter.setValueAtTime(parameter.value, audioContext.currentTime);
    parameter.linearRampToValueAtTime(value, audioContext.currentTime + rampDuration);
}

function equalLoudnessCorrection(frequency) {
    return 2500 * (Math.pow(frequency, -1.5) + Math.pow(frequency, -1.4))
}



function updateFrequency() {
    const scaleDegree = 4 * noteKeyDown[0] + 2 * noteKeyDown[1] + noteKeyDown[2]
    if (scaleDegree > 0) {
        baseAmplitude = 2;
        baseFrequency = middleC * Math.pow(2, majorScaleSteps[scaleDegree - 1] / 12);

        if (noteKeyDown[3]) {
            // Sharp key held down
            baseFrequency *= Math.pow(2, 1 / 12);
        }

        baseFrequency *= Math.pow(2, currentOctave);

        setAudioParameter(oscillatorAmplitudeNode.gain, baseAmplitude * equalLoudnessCorrection(baseFrequency))
    } else {
        baseAmplitude = 0;
    }
}

function updateAmplitude() {
    const scaleDegree = 4 * noteKeyDown[0] + 2 * noteKeyDown[1] + noteKeyDown[2]
    if (scaleDegree == 0) {
        setAudioParameter(oscillatorAmplitudeNode.gain, 0)
    }
}



function noteKeyTouchStart(finger) {
    const oscillatorAmplitudeIs0 = (noteKeyDown[0] + noteKeyDown[1] + noteKeyDown[2]) == 0
    noteKeyDown[finger] = true;
    updateFrequency();

    if (oscillatorAmplitudeIs0) {
        setAudioParameter(oscillatorAmplitudeNode.gain, baseAmplitude * equalLoudnessCorrection(baseFrequency))
    }

    const opacity = 0.8 * (finger == 3 ? 0.6 : 1)
    document.getElementById(`note-key-${finger}`).style.setProperty("opacity", `${opacity}`);
}

function noteKeyTouchEnd(finger) {
    noteKeyDown[finger] = false;
    updateFrequency();
    updateAmplitude();

    const opacity = 1 * (finger == 3 ? 0.6 : 1)
    document.getElementById(`note-key-${finger}`).style.setProperty("opacity", `${opacity}`);
}


function updateNoteKeyColours() {
    let noteKeys = document.getElementsByClassName("note-key");
    const hue = currentOctave > 0 ? 184 : 342
    const lightness = 100 - (Math.abs(currentOctave) * 50 / (currentOctave > 0 ? 3 : 2))
    for (key of noteKeys) {
        key.style.setProperty("background-color", `hsl(${hue}, 100%, ${lightness}%)`);
    }
}

function updateNoteKeyColumnOpacity(opacity) {
    document.getElementById(`note-key-column`).style.setProperty("opacity", `${Math.max(0, Math.min(1, opacity))}`);
}

function octaveKeyTouchMove(event) {
    const octaveTouches = Object.entries(event.touches).filter(t => t[1].target.className.startsWith("octave-key"))
    if (octaveTouches.length == 0) {
        currentOctave = 0;
    } else {
        const touch = octaveTouches[octaveTouches.length - 1][1];
        let x = touch.pageX;
        let y = touch.pageY;

        const touchTarget = touch.target;
        const currentElement = document.elementFromPoint(x, y);

        if (touchTarget.className == currentElement.className) {
            const octaveString = currentElement.id.substring(6)
            currentOctave = parseInt(octaveString);
        }
    }
    updateNoteKeyColours();
    updateFrequency();
}

function setUpAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // 4sin^3(x) = 3sin(x) + sin(3x)
    const realCoeffs = new Float32Array([0,0,0,0]); // No DC offset or cosine components
    const imagCoeffs = new Float32Array([0,3,0,1]); // Sine components
    const wave = audioContext.createPeriodicWave(realCoeffs, imagCoeffs);

    oscillator = audioContext.createOscillator();
    oscillator.setPeriodicWave(wave);
    oscillator.frequency.value = 440 / Math.pow(2, 0.75); // hertz

    oscillatorAmplitudeNode = audioContext.createGain();
    oscillatorAmplitudeNode.gain.setValueAtTime(0, audioContext.currentTime);

    lowPassFilter = audioContext.createBiquadFilter();
    lowPassFilter.type = "lowpass";
    lowPassFilter.frequency.value = 24000;

    mixerNode = audioContext.createGain();
    mixerNode.gain.setValueAtTime(1, audioContext.currentTime); 

    oscillator.connect(oscillatorAmplitudeNode);
    oscillatorAmplitudeNode.connect(lowPassFilter);
    lowPassFilter.connect(mixerNode);
    mixerNode.connect(audioContext.destination);
}

function startOscillator() {
    setUpAudioContext()
    oscillator.start();
    requestMotionPermission();
    document.getElementById("overlay").style.display = "none";
}

function updateLoop(vibrato, volume) {
    oscillator.frequency.value = baseFrequency * vibrato;
    setAudioParameter(mixerNode.gain, volume, 1/60);
}

function requestMotionPermission() {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
            .then(response => {
                if (response == 'granted') {
                    window.addEventListener('devicemotion', handleMotionEvent);
                }
            })
            .catch(function() {
                console.log("Failed to request permission");
            });
    } else {
        window.addEventListener('devicemotion', handleMotionEvent);
    }
}

function vibratoFromAcelerometer(y) {
    return Math.pow(2, y / 12);
}

function volumeFromAccelerometer(x) {
    const sign = leftHanded ? -1 : 1;
    const scaledX = Math.min(Math.max(x * -1.4, -1), 1) * sign;
    const angle = 2 * Math.acos(scaledX) / Math.PI;
    const vol = (Math.pow(4, 1.5 * angle) - 1) / 4;
    return Math.max(vol, 0);
}

function updateLowPassFilterForVolume(volume) {
    let lowPassCutOff = baseFrequency * Math.pow(volume * 1.5, 2);
    setAudioParameter(lowPassFilter.frequency, Math.min(lowPassCutOff, 24000), 1/60);
}

function updateBackgroundColourForVibrato(vibrato) {
    const b = Math.log2(vibrato) * 12;
    const c = Math.atan(2 * b) / Math.PI;

    const redComponent = 255 * (0.5 + c);
    const greenComponent = 255 * (0.5 - c);
    const alphaComponent = Math.tanh(Math.abs(b));
    document.body.style.setProperty("background-color", `rgba(${redComponent}, ${greenComponent}, 255, ${alphaComponent})`);
}

function handleMotionEvent(event) {
    const gravityX = event.accelerationIncludingGravity.x / 9.8;
    const gravityY = event.accelerationIncludingGravity.y / 9.8;
    const gravityZ = event.accelerationIncludingGravity.z / 9.8;
    const x = event.acceleration.x / 9.8;
    const y = event.acceleration.y / 9.8;
    const z = event.acceleration.z / 9.8;

    const vibrato = vibratoFromAcelerometer(y);
    const volume = volumeFromAccelerometer(gravityX - x);

    updateLoop(vibrato, volume);
    updateNoteKeyColumnOpacity(volume);
    updateLowPassFilterForVolume(volume);
    updateBackgroundColourForVibrato(vibrato);
}


const overlay = document.getElementById("overlay");

if (navigator.maxTouchPoints >= 4) {
    // Supports at least 4 multi-touch points
    overlay.addEventListener("click", startOscillator);
} else {
    overlay.innerHTML = "Please use a device which supports at least 4 multi-touch points";
}

